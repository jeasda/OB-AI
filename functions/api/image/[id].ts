export async function onRequest({ params, env }) {
  return new Response(
    JSON.stringify({
      ok: true,
      id: params.id,
      hasRunpodKey: !!env.RUNPOD_API_KEY,
    }),
    {
      headers: { "content-type": "application/json" },
    }
  );
}
