export async function onRequestPost({ env }: any) {
  const db = env.DB;

  // 1. ดึง job ที่ยัง queued
  const job = await db
    .prepare(
      `SELECT * FROM queue WHERE status = 'queued' ORDER BY created_at LIMIT 1`
    )
    .first();

  if (!job) {
    return Response.json({ ok: true, message: "no queued job" });
  }

  // 2. อัปเดตเป็น processing
  await db
    .prepare(`UPDATE queue SET status = 'processing' WHERE id = ?`)
    .bind(job.id)
    .run();

  try {
    // 3. ยิง Runpod
    const res = await fetch(
      `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RUNPOD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: job.prompt,
            model: job.model,
          },
        }),
      }
    );

    const result = await res.json();

    // 4. อัปเดตเป็น done
    await db
      .prepare(`UPDATE queue SET status = 'done' WHERE id = ?`)
      .bind(job.id)
      .run();

    return Response.json({
      ok: true,
      job_id: job.id,
      runpod: result,
    });

  } catch (err: any) {
    // 5. error
    await db
      .prepare(`UPDATE queue SET status = 'error' WHERE id = ?`)
      .bind(job.id)
      .run();

    return Response.json({
      ok: false,
      error: err.message,
    });
  }
}
