// src/routes/queue.ts
import type { Env } from "../index";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { submitToRunpod } from "../services/runpod.service";

function corsHeaders(origin?: string) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: unknown, status = 200, origin?: string) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(origin) },
  });
}

function getCdnBase(env: Env) {
  return (env.CDN_BASE_URL || "https://cdn.obaistudio.com").replace(/\/$/, "");
}

function extFromContentType(ct: string) {
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/jpeg")) return "jpg";
  return "";
}

export async function handleQueueCreate(request: Request, env: Env, ctx: ExecutionContext, origin?: string) {
  try {
    const form = await request.formData();

    const prompt = String(form.get("prompt") || "").trim();
    const ratio = String(form.get("ratio") || "1:1").trim(); // เก็บไว้เฉย ๆ ถ้าอยากใช้ใน workflow ภายหลัง
    const file = form.get("image");

    if (!prompt) return json({ ok: false, error: "Missing explain prompt" }, 400, origin);
    if (!(file instanceof File)) return json({ ok: false, error: "Missing image file" }, 400, origin);

    const ct = file.type || "";
    const ext = extFromContentType(ct);

    // ✅ บังคับชนิดไฟล์: jpg/png เท่านั้น
    if (!ext) {
      return json({ ok: false, error: "Only JPG/PNG is allowed" }, 400, origin);
    }

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    // อัปโหลดเข้า R2
    const key = `uploads/${now.slice(0, 4)}/${now.slice(5, 7)}/${jobId}.${ext}`;
    await env.R2_RESULTS.put(key, file.stream(), {
      httpMetadata: { contentType: ext === "jpg" ? "image/jpeg" : "image/png" },
    });

    const imageUrl = `${getCdnBase(env)}/${key}`;

    // สร้าง job ใน D1
    // NOTE: ให้ตารางชื่อ jobs (ถ้าตารางชื่ออื่น ปรับตามจริง)
    await env.DB.prepare(
      `INSERT INTO jobs (id, status, prompt, ratio, image_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(jobId, "UPLOADED", prompt, ratio, imageUrl, now, now)
      .run();

    // ✅ Auto-submit to RunPod (payload ถูกต้องแล้ว)
    let runpod: any = null;
    try {
      runpod = await submitToRunpod({ prompt, imageUrl }, env);

      // เซฟ runpod request id / status
      await env.DB.prepare(
        `UPDATE jobs SET status=?, runpod_id=?, updated_at=? WHERE id=?`
      )
        .bind(runpod.status || "IN_QUEUE", runpod.id || null, new Date().toISOString(), jobId)
        .run();
    } catch (e: any) {
      // ถ้า submit fail ให้เก็บ error ไว้
      await env.DB.prepare(
        `UPDATE jobs SET status=?, error=?, updated_at=? WHERE id=?`
      )
        .bind("FAILED", e?.message || String(e), new Date().toISOString(), jobId)
        .run();

      return json({ ok: false, jobId, error: e?.message || String(e) }, 500, origin);
    }

    return json(
      {
        ok: true,
        jobId,
        status: runpod?.status || "IN_QUEUE",
        image_url: imageUrl,
      },
      200,
      origin
    );
  } catch (e: any) {
    console.error(e);
    return json({ ok: false, error: e?.message || String(e) }, 500, origin);
  }
}

export async function handleQueueStatus(request: Request, env: Env, origin?: string) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ ok: false, error: "Missing id" }, 400, origin);

    const row = await env.DB.prepare(
      `SELECT id, status, image_url, result_url, error, runpod_id, updated_at
       FROM jobs WHERE id=? LIMIT 1`
    )
      .bind(id)
      .first<any>();

    if (!row) return json({ ok: false, error: "Not found" }, 404, origin);

    return json({ ok: true, job: row }, 200, origin);
  } catch (e: any) {
    console.error(e);
    return json({ ok: false, error: e?.message || String(e) }, 500, origin);
  }
}
