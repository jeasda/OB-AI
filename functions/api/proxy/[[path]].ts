export const onRequest = async (context: any) => {
    const { request, params } = context;
    const url = new URL(request.url);

    // Get the dynamic tunnel URL from KV Storage
    let tunnelUrl;
    try {
        tunnelUrl = await context.env.APP_CONFIG.get('TUNNEL_URL');
    } catch (e) {
        return new Response('KV Config Error. User: Please bind APP_CONFIG in Dashboard.', { status: 500 });
    }

    if (!tunnelUrl) {
        return new Response('Tunnel URL not configured. Go to /admin to set it.', { status: 503 });
    }

    // Construct the target URL
    // params.path is an array of path segments e.g. ['upload', 'image']
    const pathSegments = params.path as string[];
    const targetPath = pathSegments.join('/');
    const targetUrl = `${tunnelUrl}/${targetPath}${url.search}`;

    // Create a new request to forward
    const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow',
    });

    // Remove headers that might cause issues
    newRequest.headers.delete('Host');

    try {
        const response = await fetch(newRequest);

        // Create a new response to return (fixing CORS for the browser)
        const newResponse = new Response(response.body, response);

        // Set CORS headers to allow everything (since we are proxying)
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        newResponse.headers.set('Access-Control-Allow-Headers', '*');

        return newResponse;
    } catch (err: any) {
        return new Response(`Proxy Error: ${err.message}`, { status: 502 });
    }
};

// Handle OPTIONS requests for CORS preflight
export const onRequestOptions = async () => {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
        },
    });
};
