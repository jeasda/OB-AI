import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { Env } from '../../env';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { prompt?: string; imageUrl?: string };
        const { prompt, imageUrl } = body;

        if (!prompt || !imageUrl) {
            return NextResponse.json({ error: 'Missing prompt or imageUrl' }, { status: 400 });
        }

        const { env } = getRequestContext<Env>();

        if (!env.DB) {
            return NextResponse.json({ error: 'Server Config Error: D1 Binding (DB) missing' }, { status: 500 });
        }

        const jobId = crypto.randomUUID();

        // 1. Insert into D1 (PENDING)
        await env.DB.prepare(
            `INSERT INTO jobs (id, status, input_image_url, prompt, created_at, updated_at) VALUES (?, 'PENDING', ?, ?, ?, ?)`
        ).bind(jobId, imageUrl, prompt, Date.now(), Date.now()).run();

        // 2. Trigger RunPod (Fire and Forget or Await)
        // We await to ensure we get the RunPod ID, but we shouldn't block too long.
        const runpodRes = await fetch(
            `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${env.RUNPOD_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: {
                        prompt,
                        image_url: imageUrl, // RunPod needs a public URL. If imageUrl is relative, this fails.
                        // Helper: Ensure imageUrl is absolute if possible? 
                        // The frontend constructs absoluteImageUrl using window.location.href.
                        // So we trust the frontend passed a valid URL.
                        job_id: jobId
                    },
                }),
            }
        );

        if (!runpodRes.ok) {
            const errText = await runpodRes.text();
            throw new Error(`RunPod Error: ${runpodRes.status} ${errText}`);
        }

        const runpodData = await runpodRes.json() as any;
        const runpodId = runpodData.id;

        // 3. Update D1 with RunPod ID
        await env.DB.prepare(
            `UPDATE jobs SET runpod_id = ?, updated_at = ? WHERE id = ?`
        ).bind(runpodId, Date.now(), jobId).run();

        return NextResponse.json({ jobId, status: 'PENDING' });

    } catch (error: any) {
        console.error('Queue create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
