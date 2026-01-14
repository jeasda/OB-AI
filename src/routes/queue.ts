import { submitToRunPod } from "../services/runpod.service";

export async function handleQueueCreate(request: Request, env: Env) {
  try {
    const form = await request.formData();

    const prompt = form.get("prompt") as string;
    const ratio = form.get("ratio") as string;
    const model = form.get("model") as string;
    const image = form.get("image") as File;

    if (!prompt || !image) {
      return new Response(
        JSON.stringify({ ok: false, error: "missing prompt or image" }),
        { status: 400 }
      );
    }

    const jobId = await submitToRunPod(env, {
      prompt,
      ratio,
      model,
      image,
    });

    return Response.json({ ok: true, jobId });
  } catch (err: any) {
    console.error("QUEUE ERROR", err);
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || "queue failed" }),
      { status: 500 }
    );
  }
}
