// src/routes/runpod.ts
import type { Env } from "../index";
import { runpodSubmitJob } from "../services/runpod";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    },
  });
}

function nowISO() {
  return new Date().toISOString();
}

export async function handleRunpod(request: Request, env: Env) {
  try {
    const body = (await request.json().catch(() => null)) as
      | { jobId?: string; prompt?: string; model?: string }
      | null;

    // โหมด A: ส่ง jobId มาเอง
    let jobId = (body?.jobId || "").trim();
    let prompt = (body?.prompt || "").trim();
    let model = (body?.model || "").trim();

    // DEBUG: Check all env vars
    console.log("=== ENV DEBUG ===");
    console.log("RUNPOD_API_KEY present?", !!env.RUNPOD_API_KEY);
    console.log("RUNPOD_API_KEY type:", typeof env.RUNPOD_API_KEY);
    console.log("RUNPOD_ENDPOINT_ID:", env.RUNPOD_ENDPOINT_ID);
    console.log("All env keys:", Object.keys(env));
    console.log("=================");

    // โหมด B: ถ้าไม่ส่ง jobId -> pick queued 1 งาน
    if (!jobId) {
      const picked = await env.DB.prepare(
        `SELECT id, prompt, model FROM jobs WHERE status='queued' ORDER BY created_at ASC LIMIT 1`
      ).all();

      const row = picked.results?.[0] as any;
      if (!row) return json({ ok: true, message: "no queued job" });

      jobId = row.id;
      prompt = row.prompt;
      model = row.model;
    } else {
      // ถ้าส่ง jobId มา แต่ไม่ได้ส่ง prompt/model -> ดึงจาก DB
      if (!prompt || !model) {
        const r = await env.DB.prepare(
          `SELECT prompt, model, status FROM jobs WHERE id = ? LIMIT 1`
        )
          .bind(jobId)
          .first();

        if (!r) return json({ ok: false, error: "jobId not found" }, 404);
        if ((r as any).status !== "queued") {
          return json({ ok: false, error: "job is not queued" }, 400);
        }

        prompt = prompt || (r as any).prompt;
        model = model || (r as any).model;
      }
    }

    // ส่งไป Runpod
    const runpod = await runpodSubmitJob(env, { prompt, model, jobId });

    // อัปเดต queue: running + runpod_job_id
    const ts = nowISO();
    await env.DB.prepare(
      `UPDATE jobs
       SET runpod_job_id = ?, status = 'running', updated_at = ?
       WHERE id = ?`
    )
      .bind(runpod.id, ts, jobId)
      .run();

    return json({ ok: true, job_id: jobId, runpod: { id: runpod.id, status: runpod.status } });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
