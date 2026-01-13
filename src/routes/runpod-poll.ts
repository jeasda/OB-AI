export default async function pollHandler(
  request: Request,
  env: any
) {
  const jobs = await env.DB.prepare(
    `SELECT id, runpod_job_id FROM jobs
     WHERE status = 'queued'
     LIMIT 5`
  ).all();

  for (const job of jobs.results) {
    try {
      const res = await fetch(
        `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/status/${job.runpod_job_id}`,
        {
          headers: {
            Authorization: `Bearer ${env.RUNPOD_API_KEY}`,
          },
        }
      );

      const data = await res.json();

      if (data.status !== "COMPLETED") continue;

      const imageBase64 = data.output?.image;
      if (!imageBase64) continue;

      const buffer = Uint8Array.from(
        atob(imageBase64),
        c => c.charCodeAt(0)
      );

      const key = `outputs/${job.id}.png`;

      await env.R2_RESULTS.put(key, buffer, {
        httpMetadata: { contentType: "image/png" },
      });

      const publicUrl = `https://cdn.obaistudio.com/${key}`;

      await env.DB.prepare(
        `UPDATE jobs
         SET status = 'completed',
             output_image_url = ?,
             updated_at = ?
         WHERE id = ?`
      )
        .bind(publicUrl, Date.now(), job.id)
        .run();

    } catch (e: any) {
      await env.DB.prepare(
        `UPDATE jobs
         SET status = 'failed',
             error_message = ?
         WHERE id = ?`
      )
        .bind(String(e), job.id)
        .run();
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
