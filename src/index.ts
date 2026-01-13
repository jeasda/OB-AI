import { handleQueueCreate, handleQueueStatus } from "./routes/queue";
import { handleRunpod } from "./routes/runpod";
import { handleRunpodPoll } from "./routes/runpod-poll";

export interface Env {
  DB: D1Database;
  R2_RESULTS: R2Bucket;
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
}

function cors(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...cors(),
    },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    if (url.pathname === "/" && req.method === "GET") {
      return json({ ok: true, service: "ob-ai-api", status: "running" });
    }

    try {
      if (url.pathname === "/api/queue/create" && req.method === "POST") {
        return await handleQueueCreate(req, env, ctx);
      }

      if (url.pathname === "/api/queue/status" && req.method === "GET") {
        return await handleQueueStatus(req, env);
      }

      if (url.pathname === "/dev/runpod" && req.method === "POST") {
        return await handleRunpod(req, env);
      }

      if (
        (url.pathname === "/dev/runpod-poll" ||
          url.pathname === "/api/runpod-poll") &&
        req.method === "POST"
      ) {
        return await handleRunpodPoll(req, env);
      }

      return json({ ok: false, error: "Not found" }, 404);
    } catch (e: any) {
      console.error(e);
      return json({ ok: false, error: e?.message || "error" }, 500);
    }
  },
};
