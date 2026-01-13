// src/routes/queue.ts
import type { Env } from "../index";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function nowISO() {
  return new Date().toISOString();
}

export async function handleQueueCreate(request: Request, env: Env) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { prompt?: string; model?: string }
      | null;

    const prompt = (body?.prompt || "").trim();
    const model = (body?.model || "qwen-image").trim();

    if (!prompt) return json({ ok: false, error: "prompt is required" }, 400);

    const id = crypto.randomUUID();
    const ts = nowISO();

    await env.DB.prepare(
      `INSERT INTO jobs (id, prompt, model, status, created_at, updated_at)
       VALUES (?, ?, ?, 'queued', ?, ?)`
    )
      .bind(id, prompt, model, ts, ts)
      .run();

    return json({ ok: true, id, status: "queued" });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
