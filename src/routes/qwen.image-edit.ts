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
  let stage = "init";
  await updateQwenJob(env, jobId, { status: "processing", progress: 20 });
  stage = "GUARD_CHECKS";
  if (!env.R2_RESULTS) {
    const error: any = new Error("R2_RESULTS binding missing");
    error.stage = stage;
    throw error;
  }
  if (!env.SUBMIT_PROXY_URL) {
    const error: any = new Error("SUBMIT_PROXY_URL missing");
    error.stage = stage;
    throw error;
  }
  const imageType = payload.imageType || "image/png";
  const ext = imageType.includes("jpeg") || imageType.includes("jpg")
    ? "jpg"
    : imageType.includes("png")
      ? "png"
      : "bin";
  const datePrefix = new Date().toISOString().slice(0, 10);
  const key = `${env.R2_PREFIX || "results"}/qwen-image-edit/${datePrefix}/${jobId}.${ext}`;
  stage = "R2_PUT_START";
  logEvent("info", "R2_PUT_START", {
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
  stage = "R2_PUT_OK";
  logEvent("info", "R2_PUT_OK", {
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
      stage = "CALL_PROXY_START";
      logEvent("info", "CALL_PROXY_START", {
        endpoint: submitProxyBase,
        timestamp: new Date().toISOString(),
        attempt,
      });
      logEvent("info", "SUBMIT_PROXY_CALL_ATTEMPT", {
        trace_id: jobId,
        url: `${submitProxyBase}/submit`,
        timestamp: new Date().toISOString(),
      });
      let proxyRes: Response;
      try {
        proxyRes = await submitProxyFetch(env, jobId, "/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-request-id": jobId,
            "x-ob-source": "worker",
          },
          body: JSON.stringify(runpodPayload),
        });
      } catch (error: any) {
        const fetchError: any = new Error(`FETCH_TO_SUBMIT_PROXY_FAILED: ${error?.message || "unknown error"}`);
        fetchError.fetchFailed = true;
        throw fetchError;
      }
      const proxyText = await proxyRes.text();
      const bodyPreview = proxyText.slice(0, 2048);
      stage = "CALL_PROXY_DONE";
      logEvent("info", "CALL_PROXY_DONE", {
        trace_id: jobId,
        status: proxyRes.status,
        bodyPreview,
        timestamp: new Date().toISOString(),
      });
      if (!proxyRes.ok) {
        if (proxyRes.status === 401) {
          logEvent("warn", "API_PROXY_AUTH_401", {
            trace_id: jobId,
            status: proxyRes.status,
            bodyPreview,
            timestamp: new Date().toISOString(),
          });
        }
        return {
          proxyResponse: new Response(proxyText, {
            status: proxyRes.status,
            headers: {
              "content-type": proxyRes.headers.get("content-type") || "application/json",
            },
          }),
        };
      }
      const proxyJson = JSON.parse(proxyText);
      runpodId = proxyJson?.runpodRequestId || proxyJson?.jobId || null;
      break;
    } catch (error: any) {
      lastError = error;
      logEvent("error", "API_CRASH", {
        errorMessage: error?.message || "submit proxy failed",
        stack: error?.stack,
        endpoint: submitProxyBase,
        stage,
        timestamp: new Date().toISOString(),
      });
      if (error && !error.stage) {
        error.stage = stage;
      }
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
  return { runpodId };
}

export async function handleQwenImageEdit(req: Request, env: Env, ctx: ExecutionContext) {
  const requestId = getRequestId(req);
  const origin = req.headers.get("origin") || "";
  const phaseHeader = req.headers.get("x-phase") || "";
  if (origin === "https://ob-ai.pages.dev" || phaseHeader === "1.1") {
    // Phase 1.1 auth bypass  must be removed after Phase 1.1
    logEvent("info", "API_AUTH_BYPASS_PHASE_1_1", {
      requestId,
      origin,
      phaseHeader,
      timestamp: new Date().toISOString(),
    });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed", requestId }, { status: 405, headers: corsHeaders() });
  }

  let stage = "API_RECEIVED";
  logEvent("info", "API_RECEIVED", {
    requestId,
    timestamp: new Date().toISOString(),
  });
  try {
    stage = "BODY_PARSE";
    const payload = await parseRequest(req);
    logEvent("info", "BODY_PARSED", {
      requestId,
      timestamp: new Date().toISOString(),
    });
    if (!payload.image) {
      const error: any = new Error("image missing");
      error.stage = "BODY_PARSED";
      throw error;
    }
    if (!payload.prompt) {
      const error: any = new Error("prompt missing");
      error.stage = "BODY_PARSED";
      throw error;
    }
    if (!env.R2_RESULTS) {
      const error: any = new Error("R2_RESULTS binding missing");
      error.stage = "GUARD_CHECKS";
      throw error;
    }
    if (!env.SUBMIT_PROXY_URL) {
      const error: any = new Error("SUBMIT_PROXY_URL missing");
      error.stage = "GUARD_CHECKS";
      throw error;
    }

    stage = "JOB_CREATE";
    const job = await createQwenJob(env);
    logEvent("info", "qwen.job.created", { jobId: job.jobId, created_at_ms: Date.now() });
    stage = "PROCESS_JOB";
    const result = await processJob(env, job.jobId, payload);
    if ((result as any)?.proxyResponse) {
      await updateQwenJob(env, job.jobId, {
        status: "error",
        progress: 0,
        error: "Submit proxy error",
      });
      return (result as any).proxyResponse;
    }
    return jsonResponse(
      { job_id: job.jobId, status: "submitted" },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: any) {
    const crashStage = error?.stage || stage;
    logEvent("error", "API_CRASH", {
      requestId,
      stage: crashStage,
      errorMessage: error?.message || "unknown error",
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    });
    return jsonResponse(
      {
        error: "API_WORKER_CRASH",
        stage: crashStage,
        message: error?.message || "unknown error",
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}
