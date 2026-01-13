import { submitToRunPod } from "../services/runpod.service";

export default async function runpodHandler(
  request: Request,
  env: any
) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const form = await request.formData();

  const prompt = form.get("prompt") as string;
  const ratio = (form.get("ratio") as string) || "1:1";
  const model = (form.get("model") as string) || "qwen-image";
  const imageFile = form.get("image") as File;

  if (!prompt || !imageFile) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing prompt or image" }),
      { status: 400 }
    );
  }

  // upload input image to R2
  const inputKey = `inputs/${crypto.randomUUID()}.png`;
  const buffer = await imageFile.arrayBuffer();

  await env.R2_RESULTS.put(inputKey, buffer, {
    httpMetadata: { contentType: "image/png" },
  });

  const imageUrl = `https://cdn.obaistudio.com/${inputKey}`;

  // create job id
  const jobId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO jobs
     (id, status, prompt, model, ratio, image_url, created_at, updated_at)
     VALUES (?, 'queued', ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      jobId,
      prompt,
      model,
      ratio,
      imageUrl,
      Date.now(),
      Date.now()
    )
    .run();

  // submit to RunPod
  await submitToRunPod(env, {
    jobId,
    prompt,
    image: imageUrl,
    ratio,
    model,
  });

  return new Response(
    JSON.stringify({ ok: true, jobId }),
    { headers: { "Content-Type": "application/json" } }
  );
}
