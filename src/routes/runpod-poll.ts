import type { Env } from "../env";
import { extractOutputImageUrl } from "../services/runpod_helpers";
import { errorResponse, getRequestId, okResponse } from "../utils/http";
import { logEvent } from "../utils/log";

export async function handlePoll(
  req: Request,
  env: Env
): Promise<Response> {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const requestId = getRequestId(req);

  if (!jobId) {
    logEvent("warn", "runpod.poll.missing_job_id", { requestId });
    return errorResponse("Missing jobId", requestId, 400);
  }

  if (!env.SUBMIT_PROXY_URL) {
    return errorResponse("SUBMIT_PROXY_URL is not set", requestId, 500);
  }
  logEvent("info", "JOB_STATUS_POLL", {
    requestId,
    job_id: jobId,
    endpoint: env.SUBMIT_PROXY_URL,
    timestamp: new Date().toISOString(),
  });
  const proxyRes = await fetch(`${env.SUBMIT_PROXY_URL.replace(/\/$/, "")}/status/${encodeURIComponent(jobId)}`, {
    headers: {
      Authorization: env.RUNPOD_API_KEY ? `Bearer ${env.RUNPOD_API_KEY}` : "",
    },
  });
  const proxyText = await proxyRes.text();
  if (!proxyRes.ok) {
    return errorResponse(proxyText || "Submit proxy failed", requestId, 502);
  }
  const proxyJson = JSON.parse(proxyText);
  const status = proxyJson?.status;

  if (status?.status !== "COMPLETED") {
    return okResponse({ status: status?.status }, requestId);
  }

  const imageUrl = extractOutputImageUrl(status);
  if (!imageUrl) {
    logEvent("error", "runpod.poll.no_output", { requestId, job_id: jobId });
    return errorResponse("No output image", requestId, 502);
  }

  logEvent("info", "runpod.poll.completed", { requestId, job_id: jobId });
  return okResponse({ status: "completed", image: imageUrl }, requestId);
}
