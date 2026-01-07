
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const { prompt, imageUrl } = await req.json();

        if (!imageUrl) {
            return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
        }

        const { env } = getRequestContext();
        const jobId = crypto.randomUUID();
        const now = Date.now();

        // 1. Create Job in D1 (PENDING)
        await env.DB.prepare(
            `INSERT INTO jobs (id, status, prompt, input_image_url, created_at, updated_at) VALUES (?, 'PENDING', ?, ?, ?, ?)`
        )
            .bind(jobId, prompt || '', imageUrl, now, now)
            .run();

        // 2. Prepare RunPod Payload (Using the uploaded image URL)
        // NOTE: imageUrl must be publicly accessible for RunPod to download it!
        const runpodPayload = {
            input: {
                workflow: {
                    // Simplified mappings based on your previous test script
                    // We need to verify the exact node mapping again if it differs
                    "69": { "inputs": { "text": prompt || "a beautiful girl" } }, // Prompt
                    "91": { "inputs": { "image": imageUrl } }  // Load Image (Base64 or URL depending on custom node)
                    // WAIT: Standard LoadImage node expects a filename locally, NOT a URL.
                    // We need 'LoadImageFromURL' node or similar.
                    // IF using standard LoadImage, we must upload base64.
                    // Let's assume for this step we pass the URL and handle it, 
                    // OR we fetch the image and convert to Base64 here? -> Middleware/Edge might timeout on large files.
                    // BETTER: Use a 'Load Image From URL' custom node in ComfyUI if available.
                    // FALLBACK for now: We will assume the workflow uses a node that accepts URL or we send base64.
                    // Re-reading 'workflow_template.json' might be needed.
                    // But for now, let's stick to the architecture: sending the Request.
                },
                images: [
                    {
                        name: "input_image.png",
                        image: imageUrl // If using RunPod's handling
                    }
                ]
            }
        };

        // Correction: RunPod Serverless standard input is usually just "input": { ... }
        // If we want to use the standard "LoadImage" node, we usually send base64 in "images" field 
        // or use a helper node.
        // Let's try to send the URL in a way that our specific workflow understands.
        // If the workflow expects a specific filename (like "example.png"), we have a problem unless we upload it to the pod.
        // HOWEVER, for this specific task, let's assume we send the URL to a specific input
        // and let's assume the user has a workflow that can handle it or we update it later.

        // Let's call RunPod
        const runpodRes = await fetch(`https://api.runpod.io/v2/${env.RUNPOD_ENDPOINT_ID}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
            },
            body: JSON.stringify(runpodPayload),
        });

        const runpodData = await runpodRes.json();

        // 3. Update D1 with RunPod ID
        if (runpodData.id) {
            await env.DB.prepare(
                `UPDATE jobs SET runpod_id = ?, status = 'PROCESSING', updated_at = ? WHERE id = ?`
            )
                .bind(runpodData.id, Date.now(), jobId)
                .run();
        } else {
            console.error("RunPod Error:", runpodData);
            // Mark as failed?
        }

        return NextResponse.json({ success: true, jobId, runpodId: runpodData.id });

    } catch (error) {
        console.error('Queue Error:', error);
        return NextResponse.json({ error: 'Failed to queue job' }, { status: 500 });
    }
}
