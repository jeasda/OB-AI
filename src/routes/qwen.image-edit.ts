import type { Env } from "../env";
import { getRequestId, jsonResponse } from "../utils/http";
import { createQwenJob, updateQwenJob } from "../services/qwen_jobs.service";
import { logEvent } from "../utils/log";
import { getSubmitProxyBase, submitProxyFetch } from "../utils/submitProxy";

type ParsedRequest = {
  image: Uint8Array;
  imageType?: string;
  prompt: string;
  presets: string[];
  options: Record<string, unknown>;
  reuse: boolean;
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function decodeBase64Image(raw: string) {
  const cleaned = raw.includes(",") ? raw.split(",").pop() || "" : raw;
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizePresets(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

async function parseRequest(request: Request): Promise<ParsedRequest> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body: any = await request.json();
    const image = body?.image ? decodeBase64Image(String(body.image)) : null;
    return {
      image,
      imageType: typeof body?.image_type === "string" ? body.image_type : "image/png",
      prompt: String(body?.prompt || ""),
      presets: normalizePresets(body?.presets),
      options: body?.options && typeof body.options === "object" ? body.options : {},
      reuse: parseBoolean(body?.reuse),
    };
  }

  const formData = await request.formData();
  const file = formData.get("image");
  const image = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : null;
  const presets = normalizePresets(formData.get("presets"));
  const optionsRaw = formData.get("options");
  let options: Record<string, unknown> = {};
  if (typeof optionsRaw === "string") {
    try {
      const parsed = JSON.parse(optionsRaw);
      if (parsed && typeof parsed === "object") options = parsed;
    } catch {
      options = {};
    }
  }

  return {
    image,
    imageType: file instanceof File ? file.type : "image/png",
    prompt: String(formData.get("prompt") || ""),
    presets,
    options,
    reuse: parseBoolean(formData.get("reuse")),
  };
}

async function processJob(env: Env, jobId: string, payload: ParsedRequest) {
  const { image, prompt } = payload;
  await updateQwenJob(env, jobId, { status: "processing", progress: 20 });
  if (!env.R2_RESULTS) {
    throw new Error("R2_RESULTS is not set");
  }
  const imageType = payload.imageType || "image/png";
  const ext = imageType.includes("jpeg") || imageType.includes("jpg")
    ? "jpg"
    : imageType.includes("png")
      ? "png"
      : "bin";
  const datePrefix = new Date().toISOString().slice(0, 10);
  const key = `${env.R2_PREFIX || "results"}/qwen-image-edit/${datePrefix}/${jobId}.${ext}`;
  logEvent("info", "R2_UPLOAD_START", {
    requestId: jobId,
    key,
    contentType: imageType,
    bytes: image.length,
    timestamp: new Date().toISOString(),
  });
  await env.R2_RESULTS.put(key, image, {
    httpMetadata: {
      contentType: imageType || "application/octet-stream",
    },
  });
  logEvent("info", "R2_UPLOAD_OK", {
    requestId: jobId,
    key,
    bytes: image.length,
    timestamp: new Date().toISOString(),
  });

  const runpodPayload = {
    r2_key: key,
    prompt,
    ratio: "9:16",
    service: "qwen-image-edit",
    requestId: jobId,
  };

  let runpodId: string | null = null;
  let lastError: any = null;
  const submitProxyBase = getSubmitProxyBase(env, jobId);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      logEvent("info", "API_RECEIVED", {
        requestId: jobId,
        timestamp: new Date().toISOString(),
      });
      logEvent("info", "API_FORWARD_TO_PROXY", {
        endpoint: submitProxyBase,
        timestamp: new Date().toISOString(),
        attempt,
      });
      const proxyRes = await submitProxyFetch(env, jobId, "/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-request-id": jobId,
          "x-ob-source": "worker",
        },
        body: JSON.stringify(runpodPayload),
      });
      const proxyText = await proxyRes.text();
      logEvent("info", "API_PROXY_RESPONSE", {
        requestId: jobId,
        status: proxyRes.status,
        timestamp: new Date().toISOString(),
        bodyPreview: proxyText.slice(0, 256),
      });
      if (!proxyRes.ok) {
        const detail = proxyText || `status ${proxyRes.status}`;
        const error: any = new Error(`Submit proxy failed: ${detail}`);
        error.status = proxyRes.status;
        error.proxyBody = proxyText.slice(0, 512);
        throw error;
      }
      const proxyJson = JSON.parse(proxyText);
      runpodId = proxyJson?.runpodRequestId || proxyJson?.jobId || null;
      break;
    } catch (error: any) {
      lastError = error;
      logEvent("error", "API_ERROR", {
        errorMessage: error?.message || "submit proxy failed",
        stack: error?.stack,
        endpoint: submitProxyBase,
        timestamp: new Date().toISOString(),
      });
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  if (!runpodId) {
    if (lastError) throw lastError;
    throw new Error("Submit proxy failed");
  }

  await updateQwenJob(env, jobId, {
    runpodId,
    status: "processing",
    progress: 20,
  });
  logEvent("info", "NEW_JOB_SUBMITTED", {
    jobId,
    runpod_request_id: runpodId,
    timestamp: new Date().toISOString(),
  });
}

export async function handleQwenImageEdit(req: Request, env: Env, ctx: ExecutionContext) {
  const requestId = getRequestId(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed", requestId }, { status: 405, headers: corsHeaders() });
  }

  try {
    const payload = await parseRequest(req);
    if (!payload.image) {
      return jsonResponse({ error: "image is required", requestId }, { status: 400, headers: corsHeaders() });
    }
    if (!payload.prompt) {
      return jsonResponse({ error: "prompt is required", requestId }, { status: 400, headers: corsHeaders() });
    }

    const job = await createQwenJob(env);
    logEvent("info", "qwen.job.created", { jobId: job.jobId, created_at_ms: Date.now() });
    try {
      await processJob(env, job.jobId, payload);
      return jsonResponse({ jobId: job.jobId }, { status: 200, headers: corsHeaders() });
    } catch (error: any) {
      await updateQwenJob(env, job.jobId, {
        status: "error",
        progress: 0,
        error: error?.message || "generation failed",
      });
      const status = typeof error?.status === "number" ? error.status : 502;
      return jsonResponse(
        {
          error: error?.message || "generation failed",
          requestId,
          proxyBody: error?.proxyBody || null,
        },
        { status, headers: corsHeaders() }
      );
    }
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "invalid request", requestId },
      { status: 400, headers: corsHeaders() }
    );
  }
}
