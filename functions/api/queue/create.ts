export async function onRequest({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await request.json();

  return new Response(
    JSON.stringify({
      ok: true,
      message: "queue created",
      input: body,
      model: body.model,
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    }
  );
}
