import type { PagesFunction } from "@cloudflare/workers-types";

type CreateQueueBody = {
  prompt: string;
  image_url?: string;
};

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;

  try {
    // 1) parse body
    const body = (await request.json()) as CreateQueueBody;

    if (!body.prompt) {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400 }
      );
    }

    // 2) generate job id
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    // 3) insert job (PENDING)
    await (env as any).DB.prepare(
      `
      INSERT INTO jobs (id, status, prompt, image_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
      .bind(
        jobId,
        "PENDING",
        body.prompt,
        body.image_url ?? null,
        now,
        now
      )
      .run();

    // 4) call RunPod
    const runpodRes = await fetch(
      `https://api.runpod.ai/v2/${(env as any).RUNPOD_ENDPOINT_ID}/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(env as any).RUNPOD_API_KEY}`,
        },
        body: JSON.stringify({
          input: {
            prompt: body.prompt,
            image_url: body.image_url,
          },
        }),
      }
    );

    if (!runpodRes.ok) {
      const errText = await runpodRes.text();
      throw new Error(`RunPod error: ${errText}`);
    }

    const runpodJson: any = await runpodRes.json();
    const runpodJobId = runpodJson.id;

    // 5) update job with runpod_job_id
    await (env as any).DB.prepare(
      `
      UPDATE jobs
      SET runpod_job_id = ?, updated_at = ?
      WHERE id = ?
      `
    )
      .bind(runpodJobId, new Date().toISOString(), jobId)
      .run();

    // 6) response
    return new Response(
      JSON.stringify({
        jobId,
        status: "PENDING",
      }),
      {
        headers: { "content-type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: err.message ?? "internal error" }),
      { status: 500 }
    );
  }
};
