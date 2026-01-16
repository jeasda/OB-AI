import type { Env } from "../env";
import { errorResponse, getRequestId, okResponse } from "../utils/http";
import { logEvent } from "../utils/log";
import { hashString } from "../lib/logger";
import { compileWorkflow } from "../compiler/workflow";
import { createJob, setRunPodId, failJob, completeJob, getJob, initDb } from "../services/jobs.service";
import { getPublicUrl } from "../services/r2.service";
import { buildWorkflow } from "../services/workflow.builder";
import { validateWorkflowContractV1, buildWorkflowContext } from "../lib/workflow_contract";
import { updateJobTimestamp } from "../services/job_timestamps.service";

type CreateBody = {
  prompt: string;
  ratio?: string;
  model?: string;
  service?: string;
  workflow_version?: string;
  seed?: number;
  steps?: number;
  cfg?: number;
  options?: Record<string, unknown> | null;
  imageFile?: File | null;
  imageName?: string;
};

async function readCreateInput(req: Request): Promise<CreateBody> {
  const ct = (req.headers.get("Content-Type") || "").toLowerCase();

  if (ct.includes("application/json")) {
    const body = await req.json() as any;
    return {
      prompt: String(body?.prompt ?? ""),
      ratio: body?.ratio ? String(body.ratio) : undefined,
      model: body?.model ? String(body.model) : undefined,
      service: body?.service ? String(body.service) : undefined,
      workflow_version: body?.workflow_version ? String(body.workflow_version) : undefined,
      seed: typeof body?.seed === "number" ? body.seed : undefined,
      steps: typeof body?.steps === "number" ? body.steps : undefined,
      cfg: typeof body?.cfg === "number" ? body.cfg : undefined,
      options: body?.options && typeof body.options === "object" ? body.options : null,
    };
  }

  // default: multipart/form-data or x-www-form-urlencoded
  const fd = await req.formData();
  const imageFile = fd.get("image");
  const rawOptions = fd.get("options");
  let parsedOptions: Record<string, unknown> | null = null;
  if (typeof rawOptions === "string") {
    try {
      parsedOptions = JSON.parse(rawOptions);
    } catch {
      parsedOptions = null;
    }
  }
  return {
    prompt: String(fd.get("prompt") || ""),
    ratio: fd.get("ratio") ? String(fd.get("ratio")) : undefined,
    model: fd.get("model") ? String(fd.get("model")) : undefined,
    service: fd.get("service") ? String(fd.get("service")) : undefined,
    workflow_version: fd.get("workflow_version") ? String(fd.get("workflow_version")) : undefined,
    seed: fd.get("seed") ? Number(fd.get("seed")) : undefined,
    steps: fd.get("steps") ? Number(fd.get("steps")) : undefined,
    cfg: fd.get("cfg") ? Number(fd.get("cfg")) : undefined,
    options: parsedOptions,
    imageFile: imageFile instanceof File ? imageFile : null,
    imageName: fd.get("image_name") ? String(fd.get("image_name")) : undefined,
  };
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

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  return uint8ToBase64(new Uint8Array(buffer));
}

export async function handleQueueCreate(req: Request, env: Env) {
  const requestId = getRequestId(req);
  await initDb(env);

  const body = await readCreateInput(req);
  const payloadForLog = {
    prompt: body.prompt,
    ratio: body.ratio,
    model: body.model,
    service: body.service,
    hasImage: !!body.imageFile,
    imageSizeBytes: body.imageFile?.size,
    imageType: body.imageFile?.type,
  };
  const payloadText = JSON.stringify(payloadForLog);
  logEvent("info", "JOB_REQUEST_RECEIVED", {
    requestId,
    trace_id: requestId,
    route: "/api/queue/create",
    method: "POST",
    payloadHash: hashString(payloadText),
    payloadSizeBytes: payloadText.length,
    workflow_version: env.WORKFLOW_VERSION,
    worker_image_tag: env.WORKER_IMAGE_TAG,
    runpod_endpoint_id: env.RUNPOD_ENDPOINT,
    env: env.ENVIRONMENT || "local",
  });
  const contract = validateWorkflowContractV1({
    service: body.service,
    prompt: body.prompt,
    ratio: body.ratio,
    options: body.options || null,
    imageFile: body.imageFile,
  });
  if (!contract.ok) {
    logEvent("warn", "workflow_contract.violation", {
      requestId,
      trace_id: requestId,
      errors: contract.errors,
      ...buildWorkflowContext(env),
      env: env.ENVIRONMENT || "local",
    });
    return errorResponse("workflow contract violation", requestId, 400, { errors: contract.errors });
  }
  if (!body.prompt?.trim()) {
    logEvent("warn", "queue.create.missing_prompt", { requestId });
    return errorResponse("prompt is required", requestId, 400);
  }

  const job = await createJob(env);

  try {
    const mode = env.RUNPOD_MODE || "workflow";
    if (!env.SUBMIT_PROXY_URL) {
      throw new Error("SUBMIT_PROXY_URL is not set");
    }

    if (body.imageFile) {
      const imageName = body.imageName || `input-${job.id}.png`;
      const { workflow } = buildWorkflow(
        {
          prompt: body.prompt,
          ratio: (body.ratio as any) || "1:1",
          model: "qwen-image",
          steps: body.steps,
          cfg: body.cfg,
        },
        imageName
      );

      const imageBase64 = await fileToBase64(body.imageFile);
      const input = {
        workflow,
        images: [{ name: imageName, image: imageBase64 }],
        service: body.service || "qwen-image-edit",
      };

      logEvent("info", "API_FORWARD_TO_SUBMIT_PROXY", {
        requestId,
        trace_id: requestId,
        url: `${env.SUBMIT_PROXY_URL.replace(/\/$/, "")}/submit`,
        timestamp: new Date().toISOString(),
      });
      let proxyRes: Response;
      let proxyText = "";
      try {
        proxyRes = await fetch(`${env.SUBMIT_PROXY_URL.replace(/\/$/, "")}/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });
        proxyText = await proxyRes.text();
      } catch (error: any) {
        logEvent("error", "SUBMIT_PROXY_CALL_FAILED", {
          requestId,
          error: error?.message || "submit proxy call failed",
          timestamp: new Date().toISOString(),
        });
        return errorResponse(
          "SUBMIT_PROXY_CALL_FAILED",
          requestId,
          502,
          { details: error?.message || "submit proxy call failed" }
        );
      }
      logEvent("info", "SUBMIT_PROXY_RESPONSE", {
        requestId,
        status: proxyRes.status,
        timestamp: new Date().toISOString(),
      });
      if (!proxyRes.ok) {
        logEvent("error", "SUBMIT_PROXY_ERROR", {
          requestId,
          status: proxyRes.status,
          body: proxyText,
          timestamp: new Date().toISOString(),
        });
        return errorResponse(
          "SUBMIT_PROXY_CALL_FAILED",
          requestId,
          502,
          { details: proxyText || `status ${proxyRes.status}` }
        );
      }
      const proxyJson = JSON.parse(proxyText);
      const runpodId = proxyJson?.runpodRequestId || proxyJson?.jobId;
      if (!runpodId) {
        return errorResponse("SUBMIT_PROXY_CALL_FAILED", requestId, 502, { details: "missing job id" });
      }
      await setRunPodId(env, job.id, runpodId);
      await updateJobTimestamp(env, job.id, { submitted_to_runpod_at_ms: Date.now() });
      logEvent("info", "queue.create.submitted", {
        requestId,
        trace_id: requestId,
        job_id: job.id,
        runpod_id: runpodId,
        service: body.service || "qwen-image-edit",
        workflow_version: env.WORKFLOW_VERSION,
        worker_image_tag: env.WORKER_IMAGE_TAG,
        runpod_endpoint_id: "submit-proxy",
        env: env.ENVIRONMENT || "local",
      });
      return okResponse({ job_id: job.id, runpod_id: runpodId, status: "SUBMITTED" }, requestId);
    }

    const input =
      mode === "prompt"
        ? { prompt: body.prompt }
        : { workflow: compileWorkflow({ prompt: body.prompt, ratio: body.ratio, seed: body.seed, steps: body.steps, cfg: body.cfg }) };

    logEvent("info", "API_FORWARD_TO_SUBMIT_PROXY", {
      requestId,
      trace_id: requestId,
      url: `${env.SUBMIT_PROXY_URL.replace(/\/$/, "")}/submit`,
      timestamp: new Date().toISOString(),
    });
    let proxyRes: Response;
    let proxyText = "";
    try {
      proxyRes = await fetch(`${env.SUBMIT_PROXY_URL.replace(/\/$/, "")}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      proxyText = await proxyRes.text();
    } catch (error: any) {
      logEvent("error", "SUBMIT_PROXY_CALL_FAILED", {
        requestId,
        error: error?.message || "submit proxy call failed",
        timestamp: new Date().toISOString(),
      });
      return errorResponse(
        "SUBMIT_PROXY_CALL_FAILED",
        requestId,
        502,
        { details: error?.message || "submit proxy call failed" }
      );
    }
    logEvent("info", "SUBMIT_PROXY_RESPONSE", {
      requestId,
      status: proxyRes.status,
      timestamp: new Date().toISOString(),
    });
    if (!proxyRes.ok) {
      logEvent("error", "SUBMIT_PROXY_ERROR", {
        requestId,
        status: proxyRes.status,
        body: proxyText,
        timestamp: new Date().toISOString(),
      });
      return errorResponse(
        "SUBMIT_PROXY_CALL_FAILED",
        requestId,
        502,
        { details: proxyText || `status ${proxyRes.status}` }
      );
    }
    const proxyJson = JSON.parse(proxyText);
    const runpodId = proxyJson?.runpodRequestId || proxyJson?.jobId;
    if (!runpodId) {
      return errorResponse("SUBMIT_PROXY_CALL_FAILED", requestId, 502, { details: "missing job id" });
    }
    await setRunPodId(env, job.id, runpodId);
    await updateJobTimestamp(env, job.id, { submitted_to_runpod_at_ms: Date.now() });

    logEvent("info", "queue.create.submitted", {
      requestId,
      trace_id: requestId,
      job_id: job.id,
      runpod_id: runpodId,
      workflow_version: env.WORKFLOW_VERSION,
      worker_image_tag: env.WORKER_IMAGE_TAG,
      runpod_endpoint_id: "submit-proxy",
      env: env.ENVIRONMENT || "local",
    });
    return okResponse({ job_id: job.id, runpod_id: runpodId, status: "SUBMITTED" }, requestId);
  } catch (e: any) {
    await failJob(env, job.id, String(e?.message || e));
    logEvent("error", "queue.create.submit_failed", {
      requestId,
      trace_id: requestId,
      job_id: job.id,
      error: e?.message || e,
      workflow_version: env.WORKFLOW_VERSION,
      worker_image_tag: env.WORKER_IMAGE_TAG,
      runpod_endpoint_id: "submit-proxy",
      env: env.ENVIRONMENT || "local",
    });
    return errorResponse(`RunPod submit failed: ${String(e?.message || e)}`, requestId, 502);
  }
}

export async function handleQueueStatus(req: Request, env: Env, id: string) {
  const startedAt = Date.now();
  const job = await getJob(env, id);
  const requestId = getRequestId(req);
  if (!job) {
    logEvent("warn", "queue.status.not_found", { requestId, job_id: id });
    return errorResponse("job not found", requestId, 404);
  }

  // if done, return immediately
  if (job.status === "completed") {
    if (job.result_key) {
      return okResponse({ job, result_url: await getPublicUrl(req, job.result_key) }, requestId);
    }
    return okResponse({ job }, requestId);
  }
  if (job.status === "failed") {
    return errorResponse("job failed", requestId, 200, { job });
  }
  if (!job.runpod_id) {
    logEvent("error", "queue.status.missing_runpod_id", { requestId, job_id: id });
    return errorResponse("missing runpod_id", requestId, 500, { job });
  }

  logEvent("info", "queue.status.webhook_only", {
    requestId,
    trace_id: requestId,
    job_id: id,
    runpod_id: job.runpod_id,
    workflow_version: env.WORKFLOW_VERSION,
    worker_image_tag: env.WORKER_IMAGE_TAG,
    runpod_endpoint_id: env.RUNPOD_ENDPOINT,
    env: env.ENVIRONMENT || "local",
    latencyMs: Date.now() - startedAt,
  });
  return okResponse({ job }, requestId);
}
