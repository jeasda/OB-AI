// worker/runpod/poll.ts

export interface Env {
  DB: D1Database
  RUNPOD_API_KEY: string
  RUNPOD_ENDPOINT_ID: string
}

export async function pollRunpod(env: Env) {
  // 1. ดึง job ที่กำลัง processing
  const { results } = await env.DB.prepare(`
    SELECT id, runpod_job_id
    FROM queue
    WHERE status = 'processing'
    LIMIT 5
  `).all()

  if (!results || results.length === 0) {
    return { ok: true, message: "no jobs to poll" }
  }

  for (const job of results) {
    await checkOneJob(job.id, job.runpod_job_id, env)
  }

  return { ok: true, polled: results.length }
}

async function checkOneJob(
  jobId: string,
  runpodJobId: string,
  env: Env
) {
  // 2. ยิงถาม Runpod status
  const res = await fetch(
    `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${runpodJobId}`,
    {
      headers: {
        Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
      },
    }
  )

  const data = await res.json()
  const status = data.status

  // 3. แยกเคสตามสถานะ
  if (status === "COMPLETED") {
    await env.DB.prepare(`
      UPDATE queue
      SET status = 'done'
      WHERE id = ?
    `).bind(jobId).run()
  }

  if (status === "FAILED") {
    await env.DB.prepare(`
      UPDATE queue
      SET status = 'error'
      WHERE id = ?
    `).bind(jobId).run()
  }
}
