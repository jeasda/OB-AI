import workflowTemplate from '@/lib/workflow_template.json';

// const COMFY_API_URL = 'https://parker-photograph-correctly-roy.trycloudflare.com';

export async function generateImageClient(
    prompt: string,
    negativePrompt: string,
    imageFile: File,
    steps: string,
    cfg: number,
    aspectRatio: string
): Promise<Blob> {
    // 1. Upload Image
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('overwrite', 'true');

    let uploadRes;
    try {
        // Use local proxy instead of direct URL
        uploadRes = await fetch('/api/proxy/upload/image', {
            method: 'POST',
            body: formData,
        });
    } catch (error: any) {
        throw new Error(`Upload Failed: ${error.message}`);
    }

    if (!uploadRes.ok) {
        throw new Error(`Failed to upload image: ${uploadRes.statusText}`);
    }

    const uploadData = await uploadRes.json();
    const uploadedFilename = uploadData.name;

    // 2. Prepare Workflow
    const workflow = JSON.parse(JSON.stringify(workflowTemplate));

    if (workflow["111"]) workflow["111"].inputs.prompt = prompt;
    if (workflow["110"]) workflow["110"].inputs.prompt = negativePrompt || "";

    // Update Images
    const nodeIdsToUpdate = ["78", "106", "108", "349"];
    nodeIdsToUpdate.forEach(id => {
        if (workflow[id] && workflow[id].inputs) {
            workflow[id].inputs.image = uploadedFilename;
        }
    });

    // Update KSampler
    if (workflow["3"]) {
        workflow["3"].inputs.seed = Math.floor(Math.random() * 100000000000000);
        if (steps) workflow["3"].inputs.steps = parseInt(steps);
        if (cfg) workflow["3"].inputs.cfg = cfg;
    }

    // 3. Queue Prompt
    const clientId = crypto.randomUUID();
    const payload = { prompt: workflow, client_id: clientId };

    const promptRes = await fetch('/api/proxy/prompt', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
    });

    if (!promptRes.ok) {
        throw new Error(`Failed to queue prompt: ${promptRes.statusText}`);
    }

    const promptData = await promptRes.json();
    const promptId = promptData.prompt_id;

    // 4. Poll for result
    let imageUrl = null;
    // Poll for status (timeout after ~45 minutes for slow generations)
    for (let i = 0; i < 2700; i++) {
        await new Promise(r => setTimeout(r, 1000));

        const historyRes = await fetch(`/api/proxy/history/${promptId}`);
        const historyData = await historyRes.json();

        if (historyData[promptId]?.status?.status_str === 'error') {
            throw new Error('ComfyUI Generation Failed');
        }

        if (historyData[promptId]?.outputs) {
            const outputs = historyData[promptId].outputs;
            for (const nodeId in outputs) {
                if (outputs[nodeId].images?.length > 0) {
                    const imageInfo = outputs[nodeId].images[0];
                    // Construct Proxy URL for Image View
                    imageUrl = `/api/proxy/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder || ''}&type=${imageInfo.type}`;
                    break;
                }
            }
        }
        if (imageUrl) break;
    }

    if (!imageUrl) throw new Error('Timeout waiting for generation');

    // Fetch final image through proxy
    const imageRes = await fetch(imageUrl);
    return await imageRes.blob();
}
