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

async function parseRequest(request: Request, requestId?: string): Promise<ParsedRequest> {
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
  if (requestId) {
    const keys = Array.from(formData.keys());
    logEvent("info", "FORMDATA_KEYS", {
      requestId,
      keys,
      timestamp: new Date().toISOString(),
    });
  }
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

function logStep(level: "info" | "error", event: string, step: string, fields: Record<string, unknown> = {}) {
  logEvent(level, event, { step, ...fields });
}

async function processJob(env: Env, jobId: string, payload: ParsedRequest) {
  const { image, prompt } = payload;
  let step = "INIT";
  await updateQwenJob(env, jobId, { status: "processing", progress: 20 });
  if (!env.R2_RESULTS) {
    const error: any = new Error("R2_RESULTS binding missing in API Worker environment");
    error.step = "R2_GUARD";
    throw error;
  }
  if (!env.SUBMIT_PROXY_URL) {
    const error: any = new Error("SUBMIT_PROXY_URL missing");
    error.step = "PROXY_GUARD";
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
  step = "R2_UPLOAD";
  logStep("info", "LOG_STEP_START", step, {
    requestId: jobId,
    key,
    contentType: imageType,
    bytes: image.length,
    timestamp: new Date().toISOString(),
  });
  try {
    await env.R2_RESULTS.put(key, image, {
      httpMetadata: {
        contentType: imageType || "application/octet-stream",
      },
    });
    logStep("info", "LOG_STEP_OK", step, {
      requestId: jobId,
      key,
      bytes: image.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logStep("error", "LOG_STEP_FAIL", step, {
      requestId: jobId,
      error: error?.message || "R2 upload failed",
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    });
    const wrapped: any = new Error(error?.message || "R2 upload failed");
    wrapped.step = step;
    throw wrapped;
  }

  const runpodPayload = {
    r2_key: key,
    prompt,
    ratio: "9:16",
    service: "qwen-image-edit",
    workflow: "image_qwen_image_edit_2509.json",
    requestId: jobId,
  };

  let runpodId: string | null = null;
  let lastError: any = null;
  const submitProxyBase = getSubmitProxyBase(env, jobId);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      step = "CALL_PROXY";
      const submitUrl = `${submitProxyBase}/submit`;
      const payloadJson = JSON.stringify(runpodPayload);
      logStep("info", "LOG_STEP_START", step, {
        requestId: jobId,
        url: submitUrl,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        payloadSize: payloadJson.length,
        timestamp: new Date().toISOString(),
        attempt,
      });
      let proxyRes: Response;
      try {
        proxyRes = await fetch(submitUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: payloadJson,
        });
      } catch (error: any) {
        logStep("error", "LOG_STEP_FAIL", step, {
          requestId: jobId,
          error: error?.message || "fetch failed",
          stack: error?.stack,
          timestamp: new Date().toISOString(),
        });
        const fetchError: any = new Error(`FETCH_TO_SUBMIT_PROXY_FAILED: ${error?.message || "unknown error"}`);
        fetchError.step = step;
        throw fetchError;
      }
      logStep("info", "LOG_STEP_OK", step, {
        requestId: jobId,
        status: proxyRes.status,
        timestamp: new Date().toISOString(),
      });

      step = "PARSE_PROXY_RESPONSE";
      logStep("info", "LOG_STEP_START", step, {
        requestId: jobId,
        status: proxyRes.status,
        timestamp: new Date().toISOString(),
      });
      const proxyText = await proxyRes.text();
      const bodyPreview = proxyText.slice(0, 2048);
      logEvent("info", "CALL_PROXY_DONE", {
        trace_id: jobId,
        status: proxyRes.status,
        bodyPreview,
        timestamp: new Date().toISOString(),
      });
      if (!proxyRes.ok) {
        logStep("error", "LOG_STEP_FAIL", step, {
          requestId: jobId,
          status: proxyRes.status,
          bodyPreview,
          timestamp: new Date().toISOString(),
        });
        return {
          proxyError: {
            status: proxyRes.status,
            body: proxyText,
          },
        };
      }
      let proxyJson: any;
      try {
        proxyJson = JSON.parse(proxyText);
      } catch (error: any) {
        logStep("error", "LOG_STEP_FAIL", step, {
          requestId: jobId,
          error: error?.message || "invalid json",
          bodyPreview,
          timestamp: new Date().toISOString(),
        });
        const parseError: any = new Error(error?.message || "invalid submit proxy json");
        parseError.step = step;
        throw parseError;
      }
      logStep("info", "LOG_STEP_OK", step, {
        requestId: jobId,
        timestamp: new Date().toISOString(),
      });
      runpodId = proxyJson?.runpodRequestId || proxyJson?.jobId || null;
      break;
    } catch (error: any) {
      lastError = error;
      logEvent("error", "API_CRASH", {
        errorMessage: error?.message || "submit proxy failed",
        stack: error?.stack,
        endpoint: submitProxyBase,
        step,
        timestamp: new Date().toISOString(),
      });
      if (error && !error.step) {
        error.step = step;
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
  // Phase 1.1 auth bypass  MUST be removed or restricted after Phase 1.1
  logEvent("info", "AUTH_BYPASS_APPLIED", {
    route: "/qwen/image-edit",
    requestId,
    timestamp: new Date().toISOString(),
  });
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

  logEvent("info", "API_RECEIVED", {
    requestId,
    timestamp: new Date().toISOString(),
  });
  let step = "READ_INPUT";
  let validationBypassed = false;
  try {
    logStep("info", "LOG_STEP_START", step, {
      requestId,
      timestamp: new Date().toISOString(),
    });
    let payload: ParsedRequest;
    try {
      payload = await parseRequest(req, requestId);
    } catch (error: any) {
      logStep("error", "LOG_STEP_FAIL", step, {
        requestId,
        error: error?.message || "read input failed",
        stack: error?.stack,
        timestamp: new Date().toISOString(),
      });
      const wrapped: any = new Error(error?.message || "read input failed");
      wrapped.step = step;
      throw wrapped;
    }
    logStep("info", "LOG_STEP_OK", step, {
      requestId,
      timestamp: new Date().toISOString(),
    });
    const injected: string[] = ["service", "ratio", "workflow"];
    if (!payload.prompt) {
      payload.prompt = "change her outfit color to blue, editorial look, soft contrast";
      injected.push("prompt");
    }
    if (!payload.image) {
      logEvent("warn", "PHASE_1_1_VALIDATION_BYPASSED", {
        requestId,
        reason: "image missing",
        timestamp: new Date().toISOString(),
      });
      validationBypassed = true;
    }
    const normalized = {
      service: "qwen-image-edit",
      ratio: "9:16",
      workflow: "image_qwen_image_edit_2509.json",
    };
    if (injected.length > 0) {
      logEvent("info", "PHASE_1_1_FIELDS_INJECTED", {
        requestId,
        fields: injected,
        timestamp: new Date().toISOString(),
      });
      validationBypassed = true;
    }
    if (!env.R2_RESULTS) {
      const error: any = new Error("R2_RESULTS binding missing in API Worker environment");
      error.step = "R2_GUARD";
      throw error;
    }
    if (!env.SUBMIT_PROXY_URL) {
      const error: any = new Error("SUBMIT_PROXY_URL missing");
      error.step = "PROXY_GUARD";
      throw error;
    }

    step = "JOB_CREATE";
    const job = await createQwenJob(env);
    logEvent("info", "qwen.job.created", { jobId: job.jobId, created_at_ms: Date.now() });
    step = "PROCESS_JOB";
    const result = await processJob(env, job.jobId, payload);
    if ((result as any)?.proxyError) {
      const proxyError = (result as any).proxyError;
      await updateQwenJob(env, job.jobId, {
        status: "error",
        progress: 0,
        error: "Submit proxy error",
      });
      return jsonResponse(
        {
          error: "SUBMIT_PROXY_ERROR",
          details: proxyError?.body || "",
          requestId,
          validationBypassed,
        },
        { status: 502, headers: corsHeaders() }
      );
    }
    return jsonResponse(
      {
        job_id: job.jobId,
        status: "submitted",
        validationBypassed,
        normalizedDefaults: normalized,
      },
      { status: 200, headers: corsHeaders() }
    );
  } catch (error: any) {
    const crashStep = error?.step || step;
    logEvent("error", "API_CRASH", {
      requestId,
      stage: crashStep,
      errorMessage: error?.message || "unknown error",
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    });
    return jsonResponse(
      {
        error: "API_WORKER_CRASH",
        step: crashStep,
        message: error?.message || "unknown error",
        requestId,
      },
      { status: 500, headers: corsHeaders() }
    );
  }
}
