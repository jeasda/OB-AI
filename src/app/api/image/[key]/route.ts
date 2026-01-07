
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
    const key = params.key;
    const { env } = getRequestContext();

    const object = await env.IMAGES_BUCKET.get(key);

    if (!object) {
        return new NextResponse('Image not found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return new NextResponse(object.body, {
        headers,
    });
}
