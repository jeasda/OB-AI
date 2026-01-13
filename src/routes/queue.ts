// src/routes/queue.ts
import type { Env } from "../index";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function nowISO() {
  return new Date().toISOString();
}

export async function handleQueueCreate(request: Request, env: Env) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let prompt = "";
    let model = "qwen-image";
    let ratio = "1:1";
    let imageUrl = "";

    // Handle Multipart (Required for Image Edit)
    if (contentType.includes("multipart/form-data")) {
      let formData;
      try {
        formData = await request.formData();
      } catch (err) {
        return json({ ok: false, error: "Failed to parse form data. Image too large?" }, 400);
      }

      prompt = (formData.get("prompt") as string || "").trim();
      ratio = (formData.get("ratio") as string || "1:1").trim();
      model = (formData.get("model") as string || "qwen-image").trim();

      const imageFile = formData.get("image");
      // Loose check: it's an object and has arrayBuffer method
      if (imageFile && typeof imageFile === 'object' && 'arrayBuffer' in imageFile) {
        console.log(`Processing upload...`);

        if (!env.R2_RESULTS) {
          throw new Error("R2_RESULTS binding is missing!");
        }

        const fileId = crypto.randomUUID();
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        // @ts-ignore
        const fileName = imageFile.name || "upload.png";
        // @ts-ignore
        const fileType = imageFile.type || "image/png";

        const ext = fileName.split('.').pop() || 'png';
        const r2Path = `uploads/${year}/${month}/${fileId}.${ext}`;

        // Safer upload
        try {
          // @ts-ignore
          const buffer = await imageFile.arrayBuffer();
          await env.R2_RESULTS.put(r2Path, buffer, {
            httpMetadata: { contentType: fileType }
          });
          imageUrl = `https://cdn.obaistudio.com/${r2Path}`;
          console.log(`Uploaded: ${imageUrl}`);
        } catch (uploadErr: any) {
          console.error("R2 Upload Failed:", uploadErr);
          return json({ ok: false, error: `Upload failed: ${uploadErr.message}` }, 500);
        }
      }
    } else {
      // JSON Fallback (Legacy / Test)
      const body = (await request.json().catch(() => null)) as any;
      if (body) {
        prompt = (body.prompt || "").trim();
        model = (body.model || "qwen-image").trim();
        ratio = (body.ratio || "1:1").trim();
        imageUrl = (body.image || "").trim();
      }
    }

    if (!prompt) return json({ ok: false, error: "prompt is required" }, 400);
    // For V2 Image Edit, Image is REQUIRED.
    if (!imageUrl) return json({ ok: false, error: "image is required for editing" }, 400);

    const id = crypto.randomUUID();
    const ts = nowISO();

    await env.DB.prepare(
      `INSERT INTO jobs (id, prompt, model, ratio, image_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)`
    )
      .bind(id, prompt, model, ratio, imageUrl, ts, ts)
      .run();

    return json({ ok: true, id, status: "queued" });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}

export async function handleQueueStatus(request: Request, env: Env) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) return json({ ok: false, error: "id required" }, 400);

  try {
    const job = await env.DB.prepare("SELECT status, result_url, error_message FROM jobs WHERE id = ?").bind(id).first();

    if (!job) return json({ ok: false, error: "not found" }, 404);

    return json({
      ok: true,
      status: (job as any).status,
      result_url: (job as any).result_url,
      error: (job as any).error_message
    });
  } catch (e: any) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
