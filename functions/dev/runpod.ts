export interface Env {
  DB: D1Database
  RUNPOD_API_KEY: string
  RUNPOD_ENDPOINT_ID: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
      }

      // -----------------------------
      // 1. Parse request body
      // -----------------------------
      const body = await req.json().catch(() => null)
      if (!body?.jobId) {
        return Response.json({
          ok: false,
          error: 'jobId is required'
        }, { status: 400 })
      }

      const jobId: string = body.jobId

      // -----------------------------
      // 2. Load job from queue
      // -----------------------------
      const job = await env.DB
        .prepare(`SELECT * FROM queue WHERE id = ?`)
        .bind(jobId)
        .first<any>()

      if (!job) {
        return Response.json({
          ok: false,
          error: 'Job not found'
        }, { status: 404 })
      }

      if (job.status !== 'queued') {
        return Response.json({
          ok: false,
          error: `Job status is ${job.status}, not queued`
        }, { status: 400 })
      }

      // -----------------------------
      // 3. Call RunPod
      // -----------------------------
      const runpodRes = await fetch(
        `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.RUNPOD_API_KEY}`
          },
          body: JSON.stringify({
            input: {
              prompt: job.prompt,
              model: job.model
            }
          })
        }
      )

      const runpodJson = await runpodRes.json()

      if (!runpodRes.ok || !runpodJson?.id) {
        return Response.json({
          ok: false,
          error: 'RunPod request failed',
          detail: runpodJson
        }, { status: 500 })
      }

      const runpodJobId = runpodJson.id
      const now = new Date().toISOString()

      // -----------------------------
      // 4. Update queue → running
      // -----------------------------
      await env.DB
        .prepare(`
          UPDATE queue
          SET
            runpod_job_id = ?,
            status = 'running',
            updated_at = ?
          WHERE id = ?
        `)
        .bind(runpodJobId, now, jobId)
        .run()

      // -----------------------------
      // 5. Response
      // -----------------------------
      return Response.json({
        ok: true,
        jobId,
        runpod_job_id: runpodJobId,
        status: 'running'
      })

    } catch (err: any) {
      console.error('[RUNPOD ERROR]', err)

      return Response.json({
        ok: false,
        error: err?.message || 'Unexpected error'
      }, { status: 500 })
    }
  }
}
