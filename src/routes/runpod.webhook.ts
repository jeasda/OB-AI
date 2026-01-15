import type { Env } from "../env";
import { errorResponse, getRequestId, okResponse } from "../utils/http";
import { logEvent } from "../utils/log";
import { extractBase64Png, extractOutputImageUrl } from "../services/runpod.service";
import { putPngBase64, putPngBytes, getPublicUrl } from "../services/r2.service";
import { completeJob, failJob, getJobByRunpodId, initDb } from "../services/jobs.service";
import { upsertJobMetric } from "../services/metrics.service";
import { getJobTimestamp, updateJobTimestamp } from "../services/job_timestamps.service";
import { insertWebhookEvent, markWebhookProcessed } from "../services/webhook_events.service";

function isWebhookEnabled(env: Env) {
  return String(env.RUNPOD_WEBHOOK_ENABLED || "true").toLowerCase() !== "false";
}

function isAuthorized(request: Request, env: Env) {
  const secret = env.RUNPOD_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-runpod-webhook-secret") || request.headers.get("x-webhook-secret");
  return header === secret;
}

async function verifySignature(rawBody: string, env: Env, signature: string | null) {
  if (!signature) return false;
  const secret = env.RUNPOD_WEBHOOK_SECRET;
  if (!secret) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === signature;
}

function mapStatus(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === "COMPLETED") return "completed";
  if (normalized === "FAILED") return "failed";
  if (normalized === "IN_PROGRESS" || normalized === "RUNNING") return "running";
  if (normalized === "QUEUED") return "queued";
  return "unknown";
}

function statusOrder(status: string) {
  if (status === "queued") return 1;
  if (status === "running") return 2;
  if (status === "completed") return 3;
  if (status === "failed") return 3;
  return 0;
}

export async function handleRunpodWebhook(req: Request, env: Env) {
  const requestId = getRequestId(req);
  if (!isWebhookEnabled(env)) {
    return errorResponse("webhook disabled", requestId, 403);
  }
  if (req.method !== "POST") {
    return errorResponse("Method Not Allowed", requestId, 405);
  }
  const rawBody = await req.text();
  const signature = req.headers.get("x-runpod-signature");
  const secretHeaderOk = isAuthorized(req, env);
  const signatureOk = await verifySignature(rawBody, env, signature);
  if (!secretHeaderOk && !signatureOk) {
    logEvent("warn", "runpod.webhook.unauthorized", {
      requestId,
      error_type: "auth",
      error_code: "WEBHOOK_UNAUTHORIZED",
      env: env.ENVIRONMENT || "local",
    });
    return errorResponse("unauthorized", requestId, 401);
  }

  let payload: any = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse("invalid json", requestId, 400);
  }

  await initDb(env);

  const runpodId = payload?.id || payload?.job_id || payload?.runpod_id || payload?.runpodJobId;
  if (!runpodId) {
    logEvent("warn", "runpod.webhook.missing_id", { requestId });
    return errorResponse("missing runpod id", requestId, 400);
  }

  const status = String(payload?.status || payload?.state || "");
  const statusMapped = mapStatus(status);
  const job = await getJobByRunpodId(env, runpodId);
  if (!job) {
    logEvent("warn", "runpod.webhook.job_not_found", { requestId, runpod_id: runpodId });
    return errorResponse("job not found", requestId, 404);
  }

  const eventTs = payload?.timestamp || payload?.created_at || payload?.completed_at || payload?.updated_at || Date.now();
  const eventType = statusMapped || "unknown";
  const eventId = `${job.id}:${eventType}:${eventTs}`;
  const insertResult = await insertWebhookEvent(env, {
    id: eventId,
    job_id: job.id,
    event_type: eventType,
    received_at: Date.now(),
    payload_json: rawBody.slice(0, 5000),
    status: "received",
  });
  if (!insertResult.inserted) {
    return okResponse({ job: { ...job, status: job.status } }, requestId);
  }

  const createdAt = job.created_at ? new Date(job.created_at).getTime() : Date.now();
  const now = Date.now();
  const totalDurationMs = Math.max(0, now - createdAt);
  const queueDurationMs = typeof payload?.queue_delay_ms === "number" ? payload.queue_delay_ms : null;
  const runDurationMs = typeof payload?.execution_time_ms === "number" ? payload.execution_time_ms : null;
  const costEstimate = env.COST_PER_JOB_USD ? Number(env.COST_PER_JOB_USD) : null;
  const timestamps = await getJobTimestamp(env, job.id);
  const submittedAt = timestamps?.submitted_to_runpod_at_ms || null;
  const webhookReceivedAt = now;
  let runpodStartedAt = timestamps?.runpod_started_at_ms || null;
  let runpodCompletedAt = timestamps?.runpod_completed_at_ms || null;

  if (queueDurationMs !== null && submittedAt !== null) {
    runpodStartedAt = submittedAt + queueDurationMs;
  }
  if (runDurationMs !== null) {
    runpodCompletedAt = now;
    if (runpodStartedAt === null) {
      runpodStartedAt = now - runDurationMs;
    }
  }
  await updateJobTimestamp(env, job.id, {
    runpod_started_at_ms: runpodStartedAt ?? undefined,
    runpod_completed_at_ms: runpodCompletedAt ?? undefined,
    webhook_received_at_ms: webhookReceivedAt,
  });

  const currentStatus = job.status;
  if (statusOrder(statusMapped) < statusOrder(currentStatus)) {
    logEvent("warn", "runpod.webhook.out_of_order", {
      requestId,
      trace_id: requestId,
      job_id: job.id,
      runpod_id: runpodId,
      current_status: currentStatus,
      incoming_status: statusMapped,
      reason: "status_regression",
      env: env.ENVIRONMENT || "local",
    });
    await markWebhookProcessed(env, eventId, "ignored");
    return okResponse({ job: { ...job, status: job.status } }, requestId);
  }

  if (statusMapped === "running") {
    await env.DB.prepare("UPDATE jobs SET status = 'running' WHERE id = ?").bind(job.id).run();
    await updateJobTimestamp(env, job.id, {
      runpod_started_at_ms: runpodStartedAt ?? Date.now(),
      webhook_received_at_ms: webhookReceivedAt,
    });
    await markWebhookProcessed(env, eventId, "running");
    return okResponse({ job: { ...job, status: "running" } }, requestId);
  }

  if (statusMapped === "completed") {
    const output = payload?.output || payload?.result || payload?.data || payload;
    const b64 = extractBase64Png(output);
    let key: string | null = null;

    if (b64) {
      key = await putPngBase64(env, b64, "results");
    } else {
      const imageUrl = extractOutputImageUrl(output) || extractOutputImageUrl(payload);
      if (!imageUrl) {
        await failJob(env, job.id, "webhook completed but no image output");
        return errorResponse("no image output", requestId, 200, { job });
      }
      const res = await fetch(imageUrl);
      if (!res.ok) {
        await failJob(env, job.id, `webhook image fetch failed: ${res.status}`);
        return errorResponse("image fetch failed", requestId, 200, { job });
      }
      const buffer = await res.arrayBuffer();
      key = await putPngBytes(env, buffer, "results");
    }

    await completeJob(env, job.id, key);
    const runpodWait = runpodStartedAt && submittedAt ? Math.max(0, runpodStartedAt - submittedAt) : null;
    const runpodRun = runpodCompletedAt && runpodStartedAt ? Math.max(0, runpodCompletedAt - runpodStartedAt) : null;
    const endToEnd = webhookReceivedAt && timestamps?.created_at_ms ? Math.max(0, webhookReceivedAt - timestamps.created_at_ms) : null;
    await upsertJobMetric(env, {
      job_id: job.id,
      status: "completed",
      total_duration_ms: totalDurationMs,
      runpod_queue_duration_ms: queueDurationMs,
      runpod_run_duration_ms: runpodRun,
      runpod_wait_duration_ms: runpodWait ?? null,
      end_to_end_duration_ms: endToEnd ?? null,
      submitted_to_runpod_at_ms: submittedAt ?? null,
      runpod_started_at_ms: runpodStartedAt ?? null,
      runpod_completed_at_ms: runpodCompletedAt ?? null,
      webhook_received_at_ms: webhookReceivedAt,
      cost_estimate_usd: Number.isFinite(costEstimate) ? costEstimate : null,
      created_at: new Date().toISOString(),
    });

    logEvent("info", "runpod.webhook.completed", {
      requestId,
      trace_id: requestId,
      job_id: job.id,
      runpod_id: runpodId,
      result_key: key,
      workflow_version: env.WORKFLOW_VERSION,
      worker_image_tag: env.WORKER_IMAGE_TAG,
      runpod_endpoint_id: env.RUNPOD_ENDPOINT,
      total_duration_ms: totalDurationMs,
      runpod_wait_duration_ms: runpodWait ?? null,
      runpod_run_duration_ms: runpodRun ?? null,
      end_to_end_duration_ms: endToEnd ?? null,
      env: env.ENVIRONMENT || "local",
    });
    await markWebhookProcessed(env, eventId, "completed");

    return okResponse(
      { job: { ...job, status: "completed", result_key: key }, result_url: await getPublicUrl(req, key) },
      requestId
    );
  }

  if (statusMapped === "failed") {
    const err = payload?.error || payload?.message || "runpod failed";
    await failJob(env, job.id, String(err));
    const runpodWait = runpodStartedAt && submittedAt ? Math.max(0, runpodStartedAt - submittedAt) : null;
    const runpodRun = runpodCompletedAt && runpodStartedAt ? Math.max(0, runpodCompletedAt - runpodStartedAt) : null;
    const endToEnd = webhookReceivedAt && timestamps?.created_at_ms ? Math.max(0, webhookReceivedAt - timestamps.created_at_ms) : null;
    await upsertJobMetric(env, {
      job_id: job.id,
      status: "failed",
      total_duration_ms: totalDurationMs,
      runpod_queue_duration_ms: queueDurationMs,
      runpod_run_duration_ms: runpodRun,
      runpod_wait_duration_ms: runpodWait ?? null,
      end_to_end_duration_ms: endToEnd ?? null,
      submitted_to_runpod_at_ms: submittedAt ?? null,
      runpod_started_at_ms: runpodStartedAt ?? null,
      runpod_completed_at_ms: runpodCompletedAt ?? null,
      webhook_received_at_ms: webhookReceivedAt,
      cost_estimate_usd: Number.isFinite(costEstimate) ? costEstimate : null,
      created_at: new Date().toISOString(),
    });

    logEvent("warn", "runpod.webhook.failed", {
      requestId,
      trace_id: requestId,
      job_id: job.id,
      runpod_id: runpodId,
      error: err,
      error_type: "runpod_failed",
      provider_error: err,
      workflow_version: env.WORKFLOW_VERSION,
      worker_image_tag: env.WORKER_IMAGE_TAG,
      runpod_endpoint_id: env.RUNPOD_ENDPOINT,
      total_duration_ms: totalDurationMs,
      runpod_wait_duration_ms: runpodWait ?? null,
      runpod_run_duration_ms: runpodRun ?? null,
      end_to_end_duration_ms: endToEnd ?? null,
      env: env.ENVIRONMENT || "local",
    });
    await markWebhookProcessed(env, eventId, "failed");

    return errorResponse("runpod failed", requestId, 200, { job: { ...job, status: "failed", error: err } });
  }

  logEvent("info", "runpod.webhook.ignored", {
    requestId,
    trace_id: requestId,
    job_id: job.id,
    runpod_id: runpodId,
    status: statusMapped,
    reason: "status_unknown",
    env: env.ENVIRONMENT || "local",
  });
  await markWebhookProcessed(env, eventId, "ignored");

  return okResponse({ job: { ...job, status: job.status } }, requestId);
}
