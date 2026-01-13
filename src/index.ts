// src/index.ts
import { handleQueueCreate } from "./routes/queue";
import { handleRunpod } from "./routes/runpod";
import { handleRunpodPoll } from "./routes/runpod-poll";

// Declare global types if missing from tsconfig
declare global {
  type D1Database = import("@cloudflare/workers-types").D1Database;
  type ScheduledController = import("@cloudflare/workers-types").ScheduledController;
  type ExecutionContext = import("@cloudflare/workers-types").ExecutionContext;
  type R2Bucket = import("@cloudflare/workers-types").R2Bucket;
}

export interface Env {
  DB: D1Database;
  R2_RESULTS: R2Bucket;

  // ตั้งใน Cloudflare Pages/Worker vars (หรือ .env.local ตอน dev)
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;

  // ถ้าใช้ Runpod "Serverless Endpoint"
  // เช่น https://api.runpod.ai/v2/<endpoint_id>
  RUNPOD_API_BASE?: string; // optional
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }

      const url = new URL(request.url);

      // health
      if (url.pathname === "/" && request.method === "GET") {
        return new Response("OB AI Worker Dev is running");
      }

      // API: create queue item
      if (url.pathname === "/api/queue/create" && request.method === "POST") {
        return await handleQueueCreate(request, env);
      }

      // API: check status
      if (url.pathname === "/api/queue/status" && request.method === "GET") {
        const { handleQueueStatus } = await import("./routes/queue");
        return handleQueueStatus(request, env);
      }

      // DEV: dispatch 1 queued job -> runpod
      if (url.pathname === "/dev/runpod" && request.method === "POST") {
        return handleRunpod(request, env);
      }

      // DEV: poll runpod for running jobs
      if ((url.pathname === "/dev/runpod-poll" || url.pathname === "/api/runpod-poll") && request.method === "POST") {
        return handleRunpodPoll(request, env);
      }

      // DEV: Auto-Migrate DB (Self-Healing)
      if (url.pathname === "/dev/migrate" && request.method === "GET") {
        const { handleAdminMigrate } = await import("./routes/admin");
        return handleAdminMigrate(request, env);
      }

      return json({ ok: false, error: "Not found", path: url.pathname }, 404);
    } catch (e: any) {
      // Global Error Handler to ensure CORS is always sent - SAFE SERIALIZATION
      console.error(e);
      return json({
        ok: false,
        error: typeof e === 'string' ? e : (e?.message || 'Unknown Error'),
        // stack: e?.stack // Remove stack to prevent huge payloads or sensitive leaks
      }, 500);
    }
  },

  // Cron Trigger
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runPollingLoop(env));
  },
};

async function runPollingLoop(env: Env) {
  const ROUNDS = 4;        // 4 * 15s = 60s
  const INTERVAL = 15_000; // 15 seconds

  const { pollAllRunningJobs } = await import("./services/poll.service");

  for (let i = 0; i < ROUNDS; i++) {
    // console.log(`Poll round ${i + 1}/${ROUNDS}`);
    await pollAllRunningJobs(env);

    if (i < ROUNDS - 1) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL));
    }
  }
}
