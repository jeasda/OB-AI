import { handleQueueCreate, handleQueueStatus } from "./routes/queue";
import { handleRunpod } from "./routes/runpod";

export interface Env {
  DB: D1Database;
  R2_RESULTS: R2Bucket;
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(req.url);

    if (url.pathname === "/" && req.method === "GET") {
      return json({ ok: true, service: "ob-ai-api", status: "running" });
    }

    if (url.pathname === "/api/queue/create" && req.method === "POST") {
      return handleQueueCreate(req, env);
    }

    if (url.pathname === "/api/queue/status" && req.method === "GET") {
      return handleQueueStatus(req, env);
    }

    if (url.pathname === "/dev/runpod" && req.method === "POST") {
      return handleRunpod(req, env);
    }

    if (url.pathname === "/dev/runpod" && request.method === "POST") {
      return handleRunpod(request, env);
    }

    return json({ ok: false, error: "Not found" }, 404);
  },
};
