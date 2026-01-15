import type { Env } from "../env";
import { logEvent } from "../utils/log";
import { hashString, redactSecrets } from "../lib/logger";

type EnvironmentName = "production" | "local" | string;

function environmentName(env: Env): EnvironmentName {
  return (env.ENVIRONMENT || "").toLowerCase();
}

function isProduction(env: Env) {
  return environmentName(env) === "production";
}

function isMockMode(env: Env) {
  if (isProduction(env)) return false;
  return !env.RUNPOD_ENDPOINT || env.RUNPOD_ENDPOINT === "replace-me";
}

function assertNoMockInProduction(env: Env) {
  if (isProduction(env) && isMockMode(env)) {
    throw new Error("Mock mode is disabled in production");
  }
}

function ensureProcessEnv(env: Env) {
  const globalProcess = (globalThis as any).process || ((globalThis as any).process = { env: {} });
  if (!globalProcess.env) {
    globalProcess.env = {};
  }
  if (!globalProcess.env.RUNPOD_API_KEY && env.RUNPOD_API_KEY) {
    globalProcess.env.RUNPOD_API_KEY = env.RUNPOD_API_KEY;
  }
  return globalProcess.env;
}

function getApiKey(env: Env): string {
  const envVars = ensureProcessEnv(env);
  if (!envVars.RUNPOD_API_KEY) {
    throw new Error("RUNPOD_API_KEY is not set");
  }
  return envVars.RUNPOD_API_KEY;
}

function redactedHeaders(base: Record<string, string>) {
  return redactSecrets({ ...base }) as Record<string, string>;
}

export async function submitToRunPod(
  env: Env,
  payload: Record<string, any>
) {
  assertNoMockInProduction(env);

  if (isMockMode(env)) {
    return {
      id: `local-${crypto.randomUUID()}`,
      status: "COMPLETED",
      output: { image_base64: MOCK_PNG_BASE64 },
    } as any;
  }

  const url = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT}/run`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getApiKey(env)}`,
  };

  const body = { input: payload };
  const bodyText = JSON.stringify(body);
  logEvent("info", "runpod.request", {
    method: "POST",
    url,
    headers: redactedHeaders(headers),
    endpointId: env.RUNPOD_ENDPOINT,
    payloadHash: hashString(bodyText),
    payloadSizeBytes: bodyText.length,
    redactionApplied: true,
    workflow_version: env.WORKFLOW_VERSION,
    worker_image_tag: env.WORKER_IMAGE_TAG,
    env: env.ENVIRONMENT || "local",
  });

  const startedAt = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: bodyText,
  });
  const rawText = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    json = null;
  }

  logEvent("info", "runpod.response", {
    method: "POST",
    url,
    status: res.status,
    endpointId: env.RUNPOD_ENDPOINT,
    latencyMs: Date.now() - startedAt,
    payloadHash: hashString(rawText),
    payloadSizeBytes: rawText.length,
    bodyPreview: rawText.slice(0, 512),
    workflow_version: env.WORKFLOW_VERSION,
    worker_image_tag: env.WORKER_IMAGE_TAG,
    env: env.ENVIRONMENT || "local",
  });

  if (!res.ok) {
    throw new Error((json as any)?.error || "RunPod API error");
  }

  return json as any;
}

export async function getRunPodStatus(env: Env, runpodId: string): Promise<any> {
  assertNoMockInProduction(env);

  if (isMockMode(env)) {
    return {
      id: runpodId,
      status: "COMPLETED",
      output: { image_base64: MOCK_PNG_BASE64 },
    } as any;
  }

  const url = `https://api.runpod.ai/v2/${env.RUNPOD_ENDPOINT}/status/${runpodId}`;
  const headers = {
    Authorization: `Bearer ${getApiKey(env)}`,
  };

  logEvent("info", "runpod.request", {
    method: "GET",
    url,
    headers: redactedHeaders(headers as Record<string, string>),
    endpointId: env.RUNPOD_ENDPOINT,
    redactionApplied: true,
    workflow_version: env.WORKFLOW_VERSION,
    worker_image_tag: env.WORKER_IMAGE_TAG,
    env: env.ENVIRONMENT || "local",
  });

  const startedAt = Date.now();
  const res = await fetch(url, {
    method: "GET",
    headers,
  });
  const rawText = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    json = null;
  }

  logEvent("info", "runpod.response", {
    method: "GET",
    url,
    status: res.status,
    endpointId: env.RUNPOD_ENDPOINT,
    latencyMs: Date.now() - startedAt,
    payloadHash: hashString(rawText),
    payloadSizeBytes: rawText.length,
    bodyPreview: rawText.slice(0, 512),
    workflow_version: env.WORKFLOW_VERSION,
    worker_image_tag: env.WORKER_IMAGE_TAG,
    env: env.ENVIRONMENT || "local",
  });
  if (!res.ok) {
    throw new Error((json as any)?.error || "RunPod status error");
  }
  return json as any;
}

export function extractBase64Png(output: any): string | null {
  if (!output) return null;
  if (typeof output === "string" && output.startsWith("data:image/png;base64,")) {
    return output;
  }
  if (typeof output === "object") {
    const value =
      output?.image_base64 ||
      output?.image ||
      output?.images?.[0]?.base64 ||
      output?.images?.[0];
    if (typeof value === "string") {
      return value.startsWith("data:image/png;base64,") ? value : `data:image/png;base64,${value}`;
    }
  }
  return null;
}

export function extractOutputImageUrl(output: any): string | null {
  if (!output) return null;
  if (typeof output === "string" && /^https?:\/\//.test(output)) return output;
  if (typeof output === "object") {
    const value =
      output?.url ||
      output?.image_url ||
      output?.result_url ||
      output?.images?.[0] ||
      output?.images?.[0]?.url;
    if (typeof value === "string") return value;
  }
  return null;
}

const MOCK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Wv7sAAAAASUVORK5CYII=";
