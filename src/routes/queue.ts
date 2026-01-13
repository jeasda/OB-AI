import { Env } from "../env";
import { submitToRunPod } from "../services/runpod.service";

export async function handleQueue(
  req: Request,
  env: Env
): Promise<Response> {
  const form = await req.formData();

  const prompt = form.get("prompt") as string;
  const ratio = (form.get("ratio") as string) || "9:16";
  const model = (form.get("model") as string) || "qwen-image";
  const file = form.get("image") as File;

  if (!prompt || !file) {
    return Response.json({ ok: false, error: "Missing input" }, { status: 400 });
  }

  const key = `${env.R2_PREFIX ?? "uploads"}/${crypto.randomUUID()}.png`;
  await env.R2_RESULTS.put(key, file);

  const image_url = `https://cdn.obaistudio.com/${key}`;

  const jobId = await submitToRunPod(env, {
    prompt,
    image_url,
    ratio,
    model,
  });

  await env.DB.prepare(
    `INSERT INTO jobs (id, status, prompt, model, ratio, image_url, runpod_job_id, created_at)
     VALUES (?, 'queued', ?, ?, ?, ?, ?, strftime('%s','now'))`
  ).bind(
    crypto.randomUUID(),
    prompt,
    model,
    ratio,
    image_url,
    jobId
  ).run();

  return Response.json({ ok: true, jobId });
}
