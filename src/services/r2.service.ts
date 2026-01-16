import type { Env } from "../env";
import { logEvent } from "../utils/log";
import { hashString } from "../lib/logger";

export async function putPngBase64(env: Env, base64Png: string, prefix = "results") {
  const key = `${env.R2_PREFIX}/${prefix}/${crypto.randomUUID()}.png`;
  const startedAt = Date.now();

  // Handle "data:image/png;base64,..." or raw
  const b64 = base64Png.includes(",") ? base64Png.split(",").pop()! : base64Png;
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  await env.R2_RESULTS.put(key, bytes, {
    httpMetadata: { contentType: "image/png" },
  });
  logEvent("info", "r2.put", {
    key,
    sizeBytes: bytes.length,
    latencyMs: Date.now() - startedAt,
    payloadHash: hashString(key),
    env: env.ENVIRONMENT || "local",
  });

  return key;
}

function toArrayBuffer(bytes: ArrayBuffer | Uint8Array) {
  if (bytes instanceof Uint8Array) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  return bytes;
}

export async function putPngBytes(env: Env, bytes: ArrayBuffer | Uint8Array, prefix = "results") {
  const key = `${env.R2_PREFIX}/${prefix}/${crypto.randomUUID()}.png`;
  const startedAt = Date.now();
  const body = toArrayBuffer(bytes);

  await env.R2_RESULTS.put(key, body, {
    httpMetadata: { contentType: "image/png" },
  });
  logEvent("info", "r2.put", {
    key,
    sizeBytes: body.byteLength,
    latencyMs: Date.now() - startedAt,
    payloadHash: hashString(key),
    env: env.ENVIRONMENT || "local",
  });

  return key;
}

export async function putPngBytesWithKey(env: Env, key: string, bytes: ArrayBuffer | Uint8Array) {
  const startedAt = Date.now();
  const body = toArrayBuffer(bytes);

  await env.R2_RESULTS.put(key, body, {
    httpMetadata: { contentType: "image/png" },
  });
  logEvent("info", "r2.put", {
    key,
    sizeBytes: body.byteLength,
    latencyMs: Date.now() - startedAt,
    payloadHash: hashString(key),
    env: env.ENVIRONMENT || "local",
  });

  return key;
}

export function getPublicUrlForKey(env: Env, key: string) {
  if (!env.R2_PUBLIC_BASE) {
    throw new Error("R2_PUBLIC_BASE is not set");
  }
  return `${String(env.R2_PUBLIC_BASE).replace(/\/$/, "")}/${key}`;
}

export async function getPublicUrl(request: Request, key: string) {
  // If you use a public R2 custom domain, replace this logic.
  // For now, return a signed URL-like local pattern (frontend can call /api/result/:key).
  const u = new URL(request.url);
  return `${u.origin}/api/result/${encodeURIComponent(key)}`;
}
