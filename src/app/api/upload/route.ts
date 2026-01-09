import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { Env } from '../env';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
    try {
        const { env } = getRequestContext<Env>();
        return NextResponse.json({
            status: 'ok',
            message: 'API is reachable',
            envKeys: Object.keys(env),
            hasBucket: !!env.IMAGES_BUCKET,
            hasDB: !!env.DB
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
        }

        const { env } = getRequestContext<Env>();

        // Debugging: Check Binding
        if (!env.IMAGES_BUCKET) {
            console.error('Critical: IMAGES_BUCKET binding is missing in env!');
            return NextResponse.json({ success: false, error: 'Server Config Error: R2 Binding (IMAGES_BUCKET) missing' }, { status: 500 });
        }

        const imageId = crypto.randomUUID();
        const r2Key = `uploads/${imageId}-${file.name}`;

        // Upload to R2
        await env.IMAGES_BUCKET.put(r2Key, file.stream(), {
            httpMetadata: {
                contentType: file.type,
            },
        });

        // Construct Public URL (assuming R2 is public or custom domain)
        // For now, we return the relative key or a public domain if configured.
        // Ideally, we start with a relative URL that the frontend can use or a known public domain.
        // If the bucket is bound to a custom domain (e.g. assets.obaistudio.com), use that.
        // For this setup, let's assume raw access or worker proxy. 
        // BUT checking generate.ts, it used /api/image/key. 
        // Let's return the key and a convenient URL.

        const url = `/api/image/${r2Key}`; // Proxy path if valid, or just the key for referencing

        return NextResponse.json({ success: true, url, key: r2Key });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
