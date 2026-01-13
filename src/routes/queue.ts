import { Env } from "../index";
import { nanoid } from "nanoid";

export async function handleQueueCreate(req: Request, env: Env) {
  const form = await req.formData();

  const prompt = form.get("prompt") as string;
  const ratio = form.get("ratio") as string;
  const model = form.get("model") as string;
  const image = form.get("image") as File;

  if (!prompt || !image) {
    return Response.json({ ok: false, error: "Missing prompt or image" }, { status: 400 });
  }

  const jobId = nanoid();
  const now = Date.now();

  const imageUrl = `https://cdn.obaistudio.com/uploads/${jobId}.png`;

  await env.DB.prepare(
    `INSERT INTO jobs
     (id, status, prompt, model, ratio, image_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    jobId,
    "queued",
    prompt,
    model,
    ratio,
    imageUrl,
    now,
    now
  ).run();

  return Response.json({ ok: true, jobId });
}

export async function handleQueueStatus(req: Request, env: Env) {
  const id = new URL(req.url).searchParams.get("id");

  const row = await env.DB
    .prepare(`SELECT * FROM jobs WHERE id = ?`)
    .bind(id)
    .first();

  return Response.json({ ok: true, job: row });
}
