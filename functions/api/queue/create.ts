export async function onRequestPost(context: any) {
  const { request } = context;

  const body = await request.json();

  return new Response(
    JSON.stringify({
      ok: true,
      received: body,
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    }
  );
}
