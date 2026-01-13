// src/routes/queue.ts
import type { Env } from "../index";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    },
  });
}

function nowISO() {
  return new Date().toISOString();
}

export async function handleQueueCreate(request: Request, env: Env, ctx: ExecutionContext) {
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
        // @ts-ignore
        const fileSize = imageFile.size || 0;

        console.log(`Uploading ${fileName} (${fileSize} bytes) via stream...`);

        const ext = fileName.split('.').pop() || 'png';
        const r2Path = `uploads/${year}/${month}/${fileId}.${ext}`;

        // Stream upload (Memory Efficient)
        try {
          await env.R2_RESULTS.put(r2Path, imageFile.stream(), {
            httpMetadata: { contentType: fileType }
          });
          imageUrl = `https://cdn.obaistudio.com/${r2Path}`;
          console.log(`Uploaded (Stream): ${imageUrl}`);
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

    // Auto-Submit to RunPod (Fire & Forget)
    ctx.waitUntil((async () => {
      try {
        console.log(`[Auto-Submit] Submitting job ${id} to RunPod...`);
        const { runpodSubmitJob } = await import("../services/runpod");
        const { WORKFLOW_TEMPLATE } = await import("../lib/workflow");

        // Clone workflow (Deep copy)
        const workflow = JSON.parse(JSON.stringify(WORKFLOW_TEMPLATE));

        // Inject Inputs
        const INPUT_IMAGE_NAME = `job_${id}.png`;

        // 1. Prompt Injection (Nodes 111, 348)
        if (workflow["111"]?.inputs) workflow["111"].inputs.prompt = prompt;
        if (workflow["348"]?.inputs) workflow["348"].inputs.prompt = prompt;

        // 2. Image Injection (Nodes 78, 106, 108, 349)
        // Set all to use the uploaded image name
        const imageNodes = ["78", "106", "108", "349"];
        for (const nodeId of imageNodes) {
          if (workflow[nodeId]?.inputs) {
            workflow[nodeId].inputs.image = INPUT_IMAGE_NAME;
          }
        }

        // 3. Aspect Ratio / Resolution (Nodes 112, 345)
        // Ratio: "1:1", "9:16", "16:9"
        let w = 1024, h = 1024;
        if (ratio === "9:16") { w = 768; h = 1344; }
        else if (ratio === "16:9") { w = 1344; h = 768; }

        if (workflow["112"]?.inputs) { workflow["112"].inputs.width = w; workflow["112"].inputs.height = h; }
        if (workflow["345"]?.inputs) { workflow["345"].inputs.width = w; workflow["345"].inputs.height = h; }

        // 4. Randomize Seed (Nodes 3, 340)
        // Use a large random integer
        const seed = Math.floor(Math.random() * 100000000000000);
        if (workflow["3"]?.inputs) workflow["3"].inputs.seed = seed;
        if (workflow["340"]?.inputs) workflow["340"].inputs.seed = seed;

        // Construct Payload
        const payload = {
          input: {
            workflow: workflow,
            images: [
              {
                name: INPUT_IMAGE_NAME,
                url: imageUrl
              }
            ]
          }
        };

        // Note: runpodSubmitJob handles the wrapping of 'input' key? 
        // Wait, src/services/runpod.ts wraps 'input' => body: { input: input }.
        // So here we should pass the INNER object.
        // If we want body: { input: { workflow: ..., images: ... } }
        // Then runpodSubmitJob arg 'input' should be { workflow: ..., images: ... }

        const finalPayload = {
          workflow: workflow,
          images: [
            {
              name: INPUT_IMAGE_NAME,
              url: imageUrl
            }
          ]
        };

        console.log(`[Auto-Submit] Payload keys: ${Object.keys(finalPayload)}`);

        const runpod = await runpodSubmitJob(env, finalPayload);

        const now = nowISO();
        await env.DB.prepare(
          `UPDATE jobs SET runpod_job_id = ?, status = 'running', updated_at = ? WHERE id = ?`
        ).bind(runpod.id, now, id).run();

        console.log(`[Auto-Submit] Job ${id} submitted. RunPod ID: ${runpod.id}`);
      } catch (err: any) {
        console.error(`[Auto-Submit] Failed for job ${id}:`, err);
        const now = nowISO();
        await env.DB.prepare(
          `UPDATE jobs SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
        ).bind(String(err?.message || err), now, id).run();
      }
    })());

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
