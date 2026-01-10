export const onRequestGet = async (context: any) => {
    try {
        const url = await context.env.APP_CONFIG.get('TUNNEL_URL');
        return new Response(JSON.stringify({ url }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

export const onRequestPost = async (context: any) => {
    try {
        const { request } = context;
        const { url, pin } = await request.json();

        // Simple security check (hardcoded PIN for now)
        if (pin !== '1234') { // Change this if you want a different PIN
            return new Response('Unauthorized', { status: 401 });
        }

        if (!url) {
            return new Response('Missing URL', { status: 400 });
        }

        await context.env.APP_CONFIG.put('TUNNEL_URL', url);
        return new Response(JSON.stringify({ success: true, url }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
