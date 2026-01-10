export async function onRequestPost({ request, env }: any) {
  try {
    const body = await request.json();
    const { jobId, prompt, model } = body;

    if (!jobId) {
      return new Response(
        JSON.stringify({ ok: false, error: "jobId required" }),
        { status: 400 }
      );
    }

    // 1) ยิง Runpod
    const runpodRes = await fetch(
      `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT_ID}/run`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.RUNPOD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { prompt, model },
        }),
      }
    );

    const runpodJson = await runpodRes.json();
    const runpodJobId = runpodJson?.id;

    if (!runpodJobId) {
      return new Response(
        JSON.stringify({ ok: false, error: "runpod failed" }),
        { status: 500 }
      );
    }

    // 2) UPDATE queue ใส่ runpod_job_id
    await env.DB.prepare(`
      UPDATE queue
      SET runpod_job_id = ?, status = 'running'
      WHERE id = ?
    `)
      .bind(runpodJobId, jobId)
      .run();

    return new Response(
      JSON.stringify({
        ok: true,
        job_id: jobId,
        runpod: {
          id: runpodJobId,
          status: "IN_QUEUE",
        },
      }),
      { headers: { "content-type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500 }
    );
  }
}
