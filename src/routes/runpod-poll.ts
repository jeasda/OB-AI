// src/routes/runpod-poll.ts
import type { Env } from "../index";
import { pollAllRunningJobs } from "../services/poll.service";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    },
  });
}

export async function handleRunpodPoll(_request: Request, env: Env) {
  try {
    const result = await pollAllRunningJobs(env);
    return json({ ok: true, ...result });
  } catch (e: any) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
