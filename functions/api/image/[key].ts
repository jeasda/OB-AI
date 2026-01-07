export async function onRequestGet(
  context: {
    params: { key: string };
    env: {
      RUNPOD_API_KEY: string;
      RUNPOD_ENDPOINT_ID: string;
    };
  }
) {
  const { key } = context.params;
  const { RUNPOD_API_KEY, RUNPOD_ENDPOINT_ID } = context.env;

  // ตัวอย่าง response (ตอนแรกเอาแค่นี้ให้ build ผ่าน)
  return new Response(
    JSON.stringify({
      ok: true,
      key,
      endpoint: RUNPOD_ENDPOINT_ID,
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
