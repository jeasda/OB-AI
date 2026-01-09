import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { Env } from '../../env';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const { env } = getRequestContext<Env>();

    try {
        // 1. Query D1
        const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId).first();

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        // 2. If COMPLETED or FAILED, return immediately
        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
            return NextResponse.json({
                status: job.status,
                outputUrl: job.output_image_url,
                error: job.status === 'FAILED' ? 'Generation failed' : undefined
            });
        }

        // 3. If PENDING/PROCESSING, Poll RunPod
        if (job.runpod_id) {
            const runpodRes = await fetch(
                `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${job.runpod_id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
                    },
                }
            );

            if (runpodRes.ok) {
                const runpodData = await runpodRes.json() as any;
                const rpStatus = runpodData.status; // COMPLETED, FAILED, IN_QUEUE, IN_PROGRESS

                let newStatus = job.status;
                let outputUrl = job.output_image_url;

                if (rpStatus === 'COMPLETED') {
                    newStatus = 'COMPLETED';
                    outputUrl = runpodData.output?.image_url; // Adjust based on actual RunPod output structure
                    // Alternatively, RunPod might return a list of images or a specific key.
                    // Assuming standard output format: { output: { image_url: "..." } } or similar.
                    // Note: If RunPod returns base64 or something else, handle it.
                    // Re-verifying logic: The output might need to be uploaded to R2 if RunPod returns a temporary URL?
                    // Ideally RunPod workflow uploads to R2 and returns that URL. 
                    // IF RunPod returns a URL, we save it.
                    // RunPod output typically: { output: { "result": "..." } } depending on workflow.
                    // Let's assume output contains the URL for now or we just save the whole output as string?
                    // For safety:
                    if (runpodData.output && typeof runpodData.output === 'string') {
                        outputUrl = runpodData.output;
                    } else if (runpodData.output && runpodData.output.message) {
                        outputUrl = runpodData.output.message; // some workflows
                    } else if (runpodData.output && Array.isArray(runpodData.output) && runpodData.output.length > 0) {
                        outputUrl = runpodData.output[0]; // ComfyUI often array
                    }
                } else if (rpStatus === 'FAILED') {
                    newStatus = 'FAILED';
                } else {
                    newStatus = 'PROCESSING';
                }

                // Update D1 if status changed
                if (newStatus !== job.status) {
                    await env.DB.prepare(
                        `UPDATE jobs SET status = ?, output_image_url = ?, updated_at = ? WHERE id = ?`
                    ).bind(newStatus, outputUrl, Date.now(), jobId).run();
                }

                return NextResponse.json({
                    status: newStatus,
                    outputUrl
                });
            }
        }

        return NextResponse.json({ status: job.status });

    } catch (error: any) {
        console.error('Queue status error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
