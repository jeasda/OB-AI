export async function onRequestPost({ request, env }: any) {
  const body = await request.json();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO queue (id, prompt, model, status, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, body.prompt, body.model, "queued", now)
    .run();

  return new Response(
    JSON.stringify({
      ok: true,
      id,
      status: "queued",
    }),
    { headers: { "content-type": "application/json" } }
  );
}
