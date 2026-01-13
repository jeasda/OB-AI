import type { Env } from "../env";

export function json(data: any, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export function getAllowedOrigins(env: Env): string[] {
  const raw = env.ALLOWED_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function withCors(req: Request, env: Env, res: Response): Response {
  const origin = req.headers.get("Origin") || "";
  const allowed = getAllowedOrigins(env);

  const headers = new Headers(res.headers);

  if (allowed.length === 0) {
    headers.set("Access-Control-Allow-Origin", "*");
  } else if (allowed.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");

  return new Response(res.body, { ...res, headers });
}

export function handleOptions(req: Request, env: Env) {
  return withCors(req, env, new Response(null, { status: 204 }));
}

export function assert(cond: any, message: string) {
  if (!cond) throw new Error(message);
}
