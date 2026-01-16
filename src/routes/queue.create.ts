import type { Env } from "../env";
import { errorResponse, getRequestId, okResponse } from "../utils/http";
import { logEvent } from "../utils/log";
import { logEvent } from "../utils/log";

export async function handleQueueCreate(req: Request, env: Env) {
  const requestId = getRequestId(req);
  let body: any;

  try {
    body = await req.json();
  } catch {
    logEvent("warn", "queue.create.invalid_json", { requestId });
    return errorResponse("Invalid JSON body", requestId, 400);
  }

  const { prompt, ratio = "9:16", model = "qwen-image" } = body;

  if (!prompt) {
    logEvent("warn", "queue.create.missing_prompt", { requestId });
    return errorResponse("prompt is required", requestId, 400);
  }

  try {
    if (!env.SUBMIT_PROXY_URL) {
      return errorResponse("SUBMIT_PROXY_URL is not set", requestId, 500);
    }
    logEvent("info", "FORWARDING_TO_SUBMIT_PROXY", {
      requestId,
      endpoint: env.SUBMIT_PROXY_URL,
      timestamp: new Date().toISOString(),
    });
    const proxyRes = await fetch(`${env.SUBMIT_PROXY_URL.replace(/\/$/, "")}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ratio, model }),
    });
    const proxyText = await proxyRes.text();
    if (!proxyRes.ok) {
      return errorResponse(proxyText || "Submit proxy failed", requestId, 502);
    }
    const proxyJson = JSON.parse(proxyText);
    logEvent("info", "queue.create.submitted", { requestId, runpod_id: proxyJson?.runpodRequestId });
    return okResponse({ job: proxyJson }, requestId);
  } catch (err: any) {
    logEvent("error", "queue.create.submit_failed", { requestId, error: err?.message || err });
    return errorResponse(err?.message || "Submit proxy failed", requestId, 502);
  }
}
