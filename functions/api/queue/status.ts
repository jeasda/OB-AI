export async function onRequestGet({ request, env }: any) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing id" }),
      { status: 400 }
    );
  }

  const result = await env.DB.prepare(
    "SELECT * FROM queue WHERE id = ?"
  )
    .bind(id)
    .first();

  if (!result) {
    return new Response(
      JSON.stringify({ ok: false, error: "not found" }),
      { status: 404 }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, job: result }),
    { headers: { "content-type": "application/json" } }
  );
}
