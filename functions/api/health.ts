export const onRequestGet: PagesFunction = async ({ env }) => {
  return new Response(
    JSON.stringify({
      hasRunpodKey: !!env.RUNPOD_API_KEY,
      endpoint: env.RUNPOD_ENDPOINT_ID ? "OK" : "MISSING",
      d1: !!env.DB,
      r2: !!env.IMAGES_BUCKET,
    }, null, 2),
    { headers: { "content-type": "application/json" } }
  )
}
