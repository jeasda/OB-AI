export async function onRequestPost({ request }: any) {
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
