
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // ==========================================
        // 1. Handle Admin Config API (/api/config)
        // ==========================================
        if (url.pathname === '/api/config') {
            // GET: Retrieve current URL
            if (request.method === 'GET') {
                try {
                    const currentUrl = await env.APP_CONFIG.get('TUNNEL_URL');
                    return new Response(JSON.stringify({ url: currentUrl || '' }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (e) {
                    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
                }
            }

            // POST: Update URL (Protected by PIN)
            if (request.method === 'POST') {
                try {
                    const body = await request.json();
                    const { url: newUrl, pin } = body;

                    // Hardcoded PIN check (Simple security)
                    if (pin !== '1234') {
                        return new Response('Invalid PIN', { status: 401 });
                    }

                    if (!newUrl) {
                        return new Response('URL is required', { status: 400 });
                    }

                    // Generate a clean URL
                    let cleanUrl = newUrl.trim();
                    // Remove trailing slash
                    if (cleanUrl.endsWith('/')) {
                        cleanUrl = cleanUrl.slice(0, -1);
                    }
                    // Ensure it has protocol
                    if (!cleanUrl.startsWith('http')) {
                        cleanUrl = 'https://' + cleanUrl;
                    }

                    await env.APP_CONFIG.put('TUNNEL_URL', cleanUrl);
                    return new Response('Saved successfully', { status: 200 });

                } catch (e) {
                    return new Response('Error saving config: ' + e.message, { status: 500 });
                }
            }
        }

        // ==========================================
        // 2. Handle Proxy Logic (/api/proxy/...)
        // ==========================================
        if (url.pathname.startsWith('/api/proxy/')) {
            let tunnelUrl;
            try {
                tunnelUrl = await env.APP_CONFIG.get('TUNNEL_URL');
            } catch (e) {
                return new Response('KV Config Error. User: Please bind APP_CONFIG in Dashboard.', { status: 500 });
            }

            if (!tunnelUrl) {
                return new Response('Tunnel URL not configured. Go to /admin to set it.', { status: 503 });
            }

            // Extract path after /api/proxy/
            // Example: /api/proxy/view?filename=... -> view?filename=...
            const targetPath = url.pathname.replace('/api/proxy/', '');
            const targetUrl = `${tunnelUrl}/${targetPath}${url.search}`;

            const newRequest = new Request(targetUrl, {
                method: request.method,
                headers: request.headers,
                body: request.body,
                redirect: 'follow',
            });

            // Remove Host header to avoid upstream issues
            newRequest.headers.delete('Host');

            try {
                const response = await fetch(newRequest);
                const newResponse = new Response(response.body, response);

                // CORS Headers
                newResponse.headers.set('Access-Control-Allow-Origin', '*');
                newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                newResponse.headers.set('Access-Control-Allow-Headers', '*');

                return newResponse;
            } catch (err) {
                return new Response(`Proxy Error: ${err.message}`, { status: 502 });
            }
        }

        // ==========================================
        // 3. Fallback: Serve Static Assets
        // ==========================================
        try {
            return await env.ASSETS.fetch(request);
        } catch (e) {
            return new Response('Not Found', { status: 404 });
        }
    }
};
