export type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  level: LogLevel;
  event: string;
  message?: string;
  service?: string;
  env?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  jobId?: string;
  runpodRequestId?: string;
  endpointId?: string;
  route?: string;
  method?: string;
  status?: number;
  latencyMs?: number;
  payloadHash?: string;
  payloadSizeBytes?: number;
  redactionApplied?: boolean;
  error?: {
    type?: string;
    code?: string;
    stack?: string;
    details?: unknown;
  };
  [key: string]: unknown;
};

const SECRET_KEYS = [
  "authorization",
  "api_key",
  "apikey",
  "token",
  "secret",
  "password",
  "x-api-key",
  "runpod_api_key"
];

export function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export function redactSecrets(input: unknown): unknown {
  const seen = new WeakSet<object>();

  function shouldRedact(key: string) {
    return SECRET_KEYS.includes(key.toLowerCase());
  }

  function walk(value: unknown): unknown {
    if (!value || typeof value !== "object") return value;
    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => walk(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (shouldRedact(key)) {
        result[key] = "***";
      } else {
        result[key] = walk(val);
      }
    }
    return result;
  }

  return walk(input);
}

export function safeStringify(input: unknown) {
  const seen = new WeakSet<object>();
  return JSON.stringify(input, (_key, value) => {
    if (value && typeof value === "object") {
      if (seen.has(value as object)) return "[Circular]";
      seen.add(value as object);
    }
    return value;
  });
}

export function logEvent(payload: LogPayload) {
  const basePayload: LogPayload = {
    ts: new Date().toISOString(),
    service: payload.service || "ob-ai-api",
    env: payload.env || "unknown",
    ...payload,
  };

  const redacted = payload.redactionApplied ? redactSecrets(basePayload) : basePayload;
  const line = safeStringify(redacted);

  if (payload.level === "error") {
    console.error(line);
  } else if (payload.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
