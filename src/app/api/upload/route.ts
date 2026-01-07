
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const { env } = getRequestContext();
        const buffer = await file.arrayBuffer();
        const filename = `${crypto.randomUUID()}-${file.name}`;

        // Upload to R2
        await env.IMAGES_BUCKET.put(filename, buffer, {
            httpMetadata: {
                contentType: file.type,
            },
        });

        // Construct Public URL (Assuming a custom domain or worker proxy is setup later)
        // For now, we return the R2 Key and a placeholder URL mechanism
        return NextResponse.json({
            success: true,
            key: filename,
            url: `/api/image/${filename}` // We will need a proxy route for this if R2 isn't public
        });

    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
