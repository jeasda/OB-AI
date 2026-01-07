
import { NextResponse } from 'next/server';
import workflowTemplate from '@/lib/workflow_template.json';
import { v4 as uuidv4 } from 'uuid';

const COMFY_URL = process.env.COMFY_API_URL || 'http://127.0.0.1:8188';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const prompt = formData.get('prompt') as string;
        const negativePrompt = formData.get('negativePrompt') as string;
        const steps = formData.get('steps') as string;
        const cfg = formData.get('cfg') as string;
        const aspectRatio = formData.get('aspectRatio') as string; // We might not use this if workflow is fixed, but let's keep it if needed for latents
        const imageFile = formData.get('image') as File;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }
        if (!imageFile) {
            return NextResponse.json({ error: 'Image is required' }, { status: 400 });
        }

        // 1. Upload Image to ComfyUI
        const comfyFormData = new FormData();
        comfyFormData.append('image', imageFile);
        comfyFormData.append('overwrite', 'true');

        let uploadRes;
        try {
            uploadRes = await fetch(`${COMFY_URL}/upload/image`, {
                method: 'POST',
                body: comfyFormData,
            });
        } catch (error) {
            console.error('ComfyUI Upload Error:', error);
            return NextResponse.json({ error: 'Could not connect to ComfyUI for upload.' }, { status: 503 });
        }

        if (!uploadRes.ok) {
            const errorText = await uploadRes.text();
            throw new Error(`Failed to upload image: ${uploadRes.statusText} - ${errorText}`);
        }

        const uploadData = await uploadRes.json();
        const uploadedFilename = uploadData.name;
        const uploadedSubfolder = uploadData.subfolder || '';
        const uploadedType = uploadData.type || 'input';

        // 2. Prepare Workflow
        const workflow = JSON.parse(JSON.stringify(workflowTemplate));

        // Mapping to Qwen Image Edit Workflow Nodes:
        // Node 111: Positive Prompt (TextEncodeQwenImageEditPlus)
        // Node 110: Negative Prompt (TextEncodeQwenImageEditPlus)
        // Node 3: KSampler
        // Nodes 78, 106, 108: LoadImage (We must update all of them to be safe)

        // Update Prompts
        if (workflow["111"]) {
            workflow["111"].inputs.prompt = prompt;
        }
        if (workflow["110"]) {
            workflow["110"].inputs.prompt = negativePrompt || "";
        }

        // Update Images
        // Map input image dynamically
        const nodeIdsToUpdate = ["78", "106", "108", "349"];
        nodeIdsToUpdate.forEach(id => {
            if (workflow[id] && workflow[id].inputs) {
                workflow[id].inputs.image = uploadedFilename;
            }
        });
        // If the upload put it in a subfolder, we might need to handle it, but usually standard upload goes to root of 'input'

        // Update KSampler
        if (workflow["3"]) {
            workflow["3"].inputs.seed = Math.floor(Math.random() * 100000000000000);
            if (steps) workflow["3"].inputs.steps = parseInt(steps);
            if (cfg) workflow["3"].inputs.cfg = parseFloat(cfg);
        }

        // 3. Queue Prompt
        let promptRes;
        const payload = { prompt: workflow, client_id: uuidv4() };
        console.log('Sending ComfyUI Payload:', JSON.stringify(payload, null, 2));

        try {
            promptRes = await fetch(`${COMFY_URL}/prompt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            console.error('ComfyUI Connection Error:', error);
            return NextResponse.json({ error: 'Could not connect to ComfyUI.' }, { status: 503 });
        }

        if (!promptRes.ok) {
            const errorText = await promptRes.text();
            throw new Error(`Failed to queue prompt: ${promptRes.statusText} - ${errorText}`);
        }

        const promptData = await promptRes.json();
        const promptId = promptData.prompt_id;

        // 4. Poll for result
        let imageUrl = null;

        for (let i = 0; i < 600; i++) { // Max 600 seconds (10 minutes)
            await new Promise(r => setTimeout(r, 1000));

            const historyRes = await fetch(`${COMFY_URL}/history/${promptId}`);
            const historyData = await historyRes.json();

            if (historyData[promptId] && historyData[promptId].status && historyData[promptId].status.status_str === 'error') {
                const errorDetails = historyData[promptId].status.messages
                    .filter((m: any) => m[0] === 'execution_error')
                    .map((m: any) => m[1].exception_message)
                    .join('; ');
                throw new Error(`ComfyUI Generation Failed: ${errorDetails}`);
            }

            if (historyData[promptId] && historyData[promptId].outputs) {
                // Find image output (Node 60 is SaveImage in this workflow)
                const outputs = historyData[promptId].outputs;
                // Check all outputs just in case
                for (const nodeId in outputs) {
                    if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
                        const imageInfo = outputs[nodeId].images[0];
                        const subfolder = imageInfo.subfolder || '';
                        imageUrl = `${COMFY_URL}/view?filename=${imageInfo.filename}&subfolder=${subfolder}&type=${imageInfo.type}`;
                        break;
                    }
                }
            }

            if (imageUrl) break;
        }

        if (!imageUrl) {
            return NextResponse.json({ error: 'Timeout waiting for generation' }, { status: 500 });
        }

        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) {
            throw new Error(`Failed to fetch image from ComfyUI: ${imageRes.statusText}`);
        }

        const imageBlob = await imageRes.blob();
        const imageBuffer = await imageBlob.arrayBuffer();

        return new NextResponse(imageBuffer, {
            headers: {
                'Content-Type': 'image/png',
            },
        });

    } catch (error: any) {
        console.error('Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
