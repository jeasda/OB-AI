// src/routes/runpod.ts
import { submitToRunPod } from "../services/runpod.service";

export async function handleRunpod(request: Request, env: any) {
  // 1) ดึงงาน queued 1 งาน
  const job = await env.DB.prepare(`
    SELECT id, prompt, image_url, ratio, model
    FROM jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  `).first();

  if (!job) {
    return new Response(JSON.stringify({
      ok: true,
      message: "No queued jobs"
    }), { headers: { "Content-Type": "application/json" } });
  }

  // 2) ยิงไป RunPod
  const rp = await submitToRunPod({
    prompt: job.prompt,
    image_url: job.image_url,
    ratio: job.ratio || "1:1",
    model: job.model || "qwen-image",
  }, env);

  // 3) เก็บ runpod_job_id + เปลี่ยนสถานะ
  const runpodJobId = rp?.id || rp?.job_id || null;

  await env.DB.prepare(`
    UPDATE jobs
    SET status = 'running',
        runpod_job_id = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    runpodJobId,
    Date.now(),
    job.id
  ).run();

  return new Response(JSON.stringify({
    ok: true,
    jobId: job.id,
    runpod_job_id: runpodJobId,
    runpod_response: rp
  }), { headers: { "Content-Type": "application/json" } });
}
