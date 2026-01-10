export async function pollRunpod(env: any) {
  const db = env.DB;
  const apiKey = env.RUNPOD_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "RUNPOD_API_KEY missing" };
  }

  const { results: jobs } = await db
    .prepare(
      `
      SELECT id, runpod_job_id
      FROM queue
      WHERE status IN ('queued','running')
      AND runpod_job_id IS NOT NULL
      LIMIT 5
      `
    )
    .all();

  const updated: any[] = [];

  for (const job of jobs) {
    try {
      const res = await fetch(
        `https://api.runpod.ai/v2/${job.runpod_job_id}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      const data = await res.json();
      const status = data.status;

      if (status === "COMPLETED") {
        await db
          .prepare(
            `
            UPDATE queue
            SET status='done',
                result=?,
                finished_at=?
            WHERE id=?
            `
          )
          .bind(
            JSON.stringify(data.output ?? {}),
            new Date().toISOString(),
            job.id
          )
          .run();

        updated.push({ id: job.id, status: "done" });
      } else if (status === "FAILED") {
        await db
          .prepare(
            `
            UPDATE queue
            SET status='error',
                error=?
            WHERE id=?
            `
          )
          .bind(JSON.stringify(data.error ?? {}), job.id)
          .run();

        updated.push({ id: job.id, status: "error" });
      } else {
        await db
          .prepare(
            `UPDATE queue SET status='running' WHERE id=?`
          )
          .bind(job.id)
          .run();
      }
    } catch (e) {
      console.error("poll error", e);
    }
  }

  return {
    ok: true,
    checked: jobs.length,
    updated,
  };
}
