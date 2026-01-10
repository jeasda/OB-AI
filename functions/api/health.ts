export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "ob-ai-api",
      env: {
        hasRunpodKey: !!process.env.RUNPOD_API_KEY
      }
    }),
    {
      headers: { "content-type": "application/json" }
    }
  );
}
