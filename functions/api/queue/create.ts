export async function onRequestPost({ request, env }: any) {
  const body = await request.json();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.obai_db.prepare(`
    INSERT INTO queue (id, prompt, model, status, created_at)
    VALUES (?, ?, ?, 'queued', ?)
  `)
    .bind(id, body.prompt, body.model, now)
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
