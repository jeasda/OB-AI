import { submitToRunPod } from "../services/runpod.service";

export async function handleQueueCreate(req: Request, env: Env) {
  const form = await req.formData();

  const prompt = form.get("prompt") as string;
  const imageUrl = form.get("image_url") as string;

  const result = await submitToRunPod(env, {
    prompt,
    image_url: imageUrl,
  });

  return new Response(
    JSON.stringify({
      ok: true,
      jobId: result.id,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
