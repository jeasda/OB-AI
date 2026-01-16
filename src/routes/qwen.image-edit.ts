import type { Env } from "../env";
import { getRequestId, jsonResponse } from "../utils/http";
import { createQwenJob, updateQwenJob } from "../services/qwen_jobs.service";
import { getPublicUrlForKey, putPngBytesWithKey } from "../services/r2.service";
import { submitToRunPod, getRunPodStatus, extractBase64Png, extractOutputImageUrl } from "../services/runpod.service";
import { buildWorkflow } from "../services/workflow.builder";
import { logEvent } from "../utils/log";

type ParsedRequest = {
  image: Uint8Array;
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

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
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
    prompt: String(formData.get("prompt") || ""),
    presets,
    options,
    reuse: parseBoolean(formData.get("reuse")),
  };
}

async function processJob(env: Env, jobId: string, payload: ParsedRequest) {
  const { image, prompt } = payload;
  await updateQwenJob(env, jobId, { status: "processing", progress: 20 });

  const imageName = `input-${jobId}.png`;
  const { workflow } = buildWorkflow(
    {
      prompt,
      ratio: "9:16",
      model: "qwen-image",
    },
    imageName
  );

  const imageBase64 = uint8ToBase64(image);
  const runpodPayload = {
    workflow,
    images: [{ name: imageName, image: imageBase64 }],
    service: "qwen-image-edit",
  };

  const run = await submitToRunPod(env, runpodPayload as any);
  const runpodId = run?.id || run?.job_id || null;
  if (!runpodId) {
    throw new Error("RunPod did not return a job id");
  }

  await updateQwenJob(env, jobId, {
    runpodId,
    status: "processing",
    progress: 20,
  });
  logEvent("info", "NEW_JOB_SUBMITTED", {
    jobId,
    runpod_request_id: runpodId,
    submitted_at_ms: Date.now(),
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
    ctx.waitUntil(
      processJob(env, job.jobId, payload).catch((error) => {
        updateQwenJob(env, job.jobId, {
          status: "error",
          progress: 0,
          error: error?.message || "generation failed",
        }).catch(() => {});
      })
    );

    return jsonResponse({ jobId: job.jobId }, { status: 200, headers: corsHeaders() });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "invalid request", requestId },
      { status: 400, headers: corsHeaders() }
    );
  }
}
