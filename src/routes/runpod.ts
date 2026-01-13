// src/routes/runpod.ts
import type { Env } from "../index";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { submitToRunpod } from "../services/runpod.service";

function corsHeaders(origin?: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

export async function handleRunpod(_request: Request, env: Env, _ctx: ExecutionContext, origin?: string) {
  try {
    // ดึงงานที่ UPLOADED (ยังไม่ submit)
    const job = await env.DB.prepare(
      `SELECT id, prompt, image_url FROM jobs WHERE status='UPLOADED' ORDER BY created_at ASC LIMIT 1`
    ).first<any>();

    if (!job) return json({ ok: true, message: "No UPLOADED jobs" }, 200, origin);

    const runpod = await submitToRunpod({ prompt: job.prompt, imageUrl: job.image_url }, env);

    await env.DB.prepare(
      `UPDATE jobs SET status=?, runpod_id=?, updated_at=? WHERE id=?`
    )
      .bind(runpod.status || "IN_QUEUE", runpod.id || null, new Date().toISOString(), job.id)
      .run();

    return json({ ok: true, submitted: job.id, runpod }, 200, origin);
  } catch (e: any) {
    console.error(e);
    return json({ ok: false, error: e?.message || String(e) }, 500, origin);
  }
}
