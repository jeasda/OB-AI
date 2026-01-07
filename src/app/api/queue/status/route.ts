
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    const { env } = getRequestContext();

    // 1. Get Job from D1
    const job = await env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(jobId).first();

    if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // 2. If already completed or failed, return immediately
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        return NextResponse.json({
            status: job.status,
            outputUrl: job.output_image_url
        });
    }

    // 3. "Lazy Update": If Processing, Poll RunPod
    if (job.status === 'PROCESSING' && job.runpod_id) {
        const runpodRes = await fetch(`https://api.runpod.io/v2/${env.RUNPOD_ENDPOINT_ID}/status/${job.runpod_id}`, {
            headers: {
                'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
            },
        });
        const runpodData = await runpodRes.json();

        if (runpodData.status === 'COMPLETED') {
            const outputUrl = runpodData.output?.message || runpodData.output?.images?.[0] || null;

            // Update D1
            await env.DB.prepare(
                `UPDATE jobs SET status = 'COMPLETED', output_image_url = ?, updated_at = ? WHERE id = ?`
            )
                .bind(outputUrl, Date.now(), jobId)
                .run();

            return NextResponse.json({ status: 'COMPLETED', outputUrl });

        } else if (runpodData.status === 'FAILED') {
            await env.DB.prepare(
                `UPDATE jobs SET status = 'FAILED', updated_at = ? WHERE id = ?`
            )
                .bind(Date.now(), jobId)
                .run();

            return NextResponse.json({ status: 'FAILED', error: runpodData.error });
        }
    }

    // Default: Return current status
    return NextResponse.json({ status: job.status });
}
