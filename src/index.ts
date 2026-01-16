import type { Env } from "./env";
import { handleQueueCreate, handleQueueStatus } from "./routes/queue";
import { handleResultGet } from "./routes/result";
import { handleRunpodWebhook } from "./routes/runpod.webhook";
import { errorResponse, getRequestId, okResponse } from "./utils/http";
import { logEvent } from "./utils/log";
import { handleQwenImageEdit } from "./routes/qwen.image-edit";
import { handleJobStatus } from "./routes/jobs.status";

type EnvValidation = { ok: true } | { ok: false; error: string; missing?: string[] };

function environmentName(env: Env) {
  return (env.ENVIRONMENT || "").toLowerCase();
}

function isProduction(env: Env) {
  return environmentName(env) === "production";
}

function isMockMode(env: Env) {
  if (isProduction(env)) return false;
  return !env.RUNPOD_ENDPOINT || env.RUNPOD_ENDPOINT === "replace-me";
}

function validateEnv(env: Env): EnvValidation {
  const production = isProduction(env);
  const mockMode = isMockMode(env);

  if (production && mockMode) {
    return { ok: false, error: "Mock mode is disabled in production" };
  }

  const missing: string[] = [];
    if (production || !mockMode) {
      if (!env.RUNPOD_API_KEY) missing.push("RUNPOD_API_KEY");
      if (!env.RUNPOD_ENDPOINT) missing.push("RUNPOD_ENDPOINT");
      if (!env.R2_PREFIX) missing.push("R2_PREFIX");
      if (!env.R2_PUBLIC_BASE) missing.push("R2_PUBLIC_BASE");
    }

  if (missing.length > 0) {
    return { ok: false, error: `Missing required env: ${missing.join(", ")}`, missing };
  }

  return { ok: true };
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const requestId = getRequestId(req);

    const validation = validateEnv(env);
    if (!validation.ok) {
      logEvent("error", "env.invalid", {
        requestId,
        error: validation.error,
        missing: validation.missing,
      });
      return errorResponse(validation.error, requestId, 500);
    }

    if (
      isProduction(env) &&
      (url.pathname.startsWith("/dev") || url.pathname.startsWith("/debug")) &&
      !["/debug/submit-proxy-ping", "/debug/ping", "/debug/submit-proxy", "/debug/r2"].includes(url.pathname)
    ) {
      logEvent("warn", "route.disabled", { requestId, path: url.pathname });
      return errorResponse("Not Found", requestId, 404);
    }

    // health check
    if (req.method === "GET" && url.pathname === "/") {
      return okResponse({ service: "ob-ai-api", status: "running" }, requestId);
    }

    // RunningHub-style endpoints
    if (req.method === "POST" && url.pathname === "/api/queue/create") {
      return handleQueueCreate(req, env);
    }
    if (req.method === "POST" && url.pathname === "/api/runpod/webhook") {
      return handleRunpodWebhook(req, env);
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/queue/status/")) {
      const id = url.pathname.split("/").pop() || "";
      return handleQueueStatus(req, env, id);
    }
    if (req.method === "GET" && url.pathname === "/api/queue/status") {
      const id = url.searchParams.get("id") || "";
      if (!id) return errorResponse("missing id", requestId, 400);
      return handleQueueStatus(req, env, id);
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/result/")) {
      const key = decodeURIComponent(url.pathname.replace("/api/result/", ""));
      return handleResultGet(env, key);
    }
    if (req.method === "POST" && url.pathname === "/qwen/image-edit") {
      return handleQwenImageEdit(req, env, ctx);
    }
    if (url.pathname.startsWith("/jobs/")) {
      const jobId = url.pathname.split("/").pop() || "";
      if (!jobId) return errorResponse("missing jobId", requestId, 400);
      return handleJobStatus(req, env, jobId);
    }
    if (req.method === "GET" && url.pathname === "/debug/submit-proxy-ping") {
      if (!env.SUBMIT_PROXY_URL) {
        return errorResponse("SUBMIT_PROXY_URL is not set", requestId, 500);
      }
      try {
        const healthUrl = `${env.SUBMIT_PROXY_URL.replace(/\/$/, "")}/health`;
        const res = await fetch(healthUrl);
        const text = await res.text();
        logEvent("info", "SUBMIT_PROXY_PING_RESULT", {
          requestId,
          status: res.status,
          timestamp: new Date().toISOString(),
          url: healthUrl,
        });
        return okResponse({ status: res.status, body: text }, requestId);
      } catch (error: any) {
        logEvent("error", "SUBMIT_PROXY_PING_RESULT", {
          requestId,
          error: error?.message || "ping failed",
          timestamp: new Date().toISOString(),
        });
        return errorResponse("SUBMIT_PROXY_CALL_FAILED", requestId, 502, { details: error?.message || "ping failed" });
      }
    }
    if (req.method === "GET" && url.pathname === "/debug/ping") {
      return okResponse({ ok: true, ts: new Date().toISOString(), env: env.ENVIRONMENT || "production" }, requestId);
    }
    if (req.method === "GET" && url.pathname === "/debug/submit-proxy") {
      if (!env.SUBMIT_PROXY_URL) {
        return errorResponse("SUBMIT_PROXY_URL is not set", requestId, 500);
      }
      try {
        const healthUrl = new URL(env.SUBMIT_PROXY_URL);
        healthUrl.pathname = "/health";
        const res = await fetch(healthUrl.toString());
        const text = await res.text();
        logEvent("info", "SUBMIT_PROXY_PING_RESULT", {
          requestId,
          status: res.status,
          timestamp: new Date().toISOString(),
          url: healthUrl.toString(),
        });
        return okResponse({ status: res.status, body: text }, requestId);
      } catch (error: any) {
        logEvent("error", "SUBMIT_PROXY_PING_RESULT", {
          requestId,
          error: error?.message || "ping failed",
          timestamp: new Date().toISOString(),
        });
        return errorResponse("SUBMIT_PROXY_CALL_FAILED", requestId, 502, { details: error?.message || "ping failed" });
      }
    }
    if (req.method === "GET" && url.pathname === "/debug/r2") {
      return okResponse({ ok: true, hasR2: !!env.R2_RESULTS }, requestId);
    }

    logEvent("warn", "route.not_found", { requestId, method: req.method, path: url.pathname });
    return errorResponse("Not Found", requestId, 404);
  },
};
