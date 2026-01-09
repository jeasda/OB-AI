export async function onRequest({ env }: { env: any }) {
  return new Response(
    JSON.stringify({
      ok: true,
      hasRunpodKey: !!env.RUNPOD_API_KEY,
      hasEndpointId: !!env.RUNPOD_ENDPOINT_ID,
      endpointIdPreview: env.RUNPOD_ENDPOINT_ID
        ? env.RUNPOD_ENDPOINT_ID.slice(0, 4) + '***'
        : null,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
