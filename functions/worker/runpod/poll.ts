export async function pollRunpod(env: any) {
  const db = env.DB;
  const apiKey = env.RUNPOD_API_KEY;

  // ดึง job ที่ยัง queued / running
  const jobs = await db
    .prepare(
      `SELECT id, runpod_job_id FROM queue
       WHERE status IN ('queued', 'running')
       AND runpod_job_id IS NOT NULL
       LIMIT 5`
    )
    .all();

  let updated: any[] = [];

  for (const job of jobs.results) {
    const res = await fetch(
      `https://api.runpod.ai/v2/${job.runpod_job_id}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const data = await res.json();
    const status = data?.status;

    if (status === "COMPLETED") {
      await db
        .prepare(
          `UPDATE queue SET status='done' WHERE id=?`
        )
        .bind(job.id)
        .run();

      updated.push({ id: job.id, status: "done" });
    }

    if (status === "FAILED") {
      await db
        .prepare(
          `UPDATE queue SET status='error' WHERE id=?`
        )
        .bind(job.id)
        .run();

      updated.push({ id: job.id, status: "error" });
    }
  }

  return {
    ok: true,
    checked: jobs.results.length,
    updated,
  };
}
