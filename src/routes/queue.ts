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
      | { prompt?: string; model?: string; ratio?: string; image?: string }
      | null;

    const prompt = (body?.prompt || "").trim();
    const model = (body?.model || "qwen-image").trim();
    const ratio = (body?.ratio || "1:1").trim();
    const imageUrl = (body?.image || "").trim();

    if (!prompt) return json({ ok: false, error: "prompt is required" }, 400);

    const id = crypto.randomUUID();
    const ts = nowISO();

    await env.DB.prepare(
      `INSERT INTO jobs (id, prompt, model, ratio, image_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`
    )
      .bind(id, prompt, model, ratio, imageUrl, ts, ts)
      .run();

    return json({ ok: true, id, status: "queued" });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}

export async function handleQueueStatus(request: Request, env: Env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) return json({ ok: false, error: "id required" }, 400);

  try {
    const job = await env.DB.prepare("SELECT status, result_url, error_message FROM jobs WHERE id = ?").bind(id).first();

    if (!job) return json({ ok: false, error: "not found" }, 404);

    return json({
      ok: true,
      status: (job as any).status,
      result_url: (job as any).result_url,
      error: (job as any).error_message
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
