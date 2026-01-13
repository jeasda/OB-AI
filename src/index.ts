import { Env } from "./env";
import { handleQueue } from "./routes/queue";
import { handlePoll } from "./routes/runpod-poll";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/api/queue/create") {
      return handleQueue(req, env);
    }

    if (req.method === "GET" && url.pathname === "/api/runpod/poll") {
      return handlePoll(req, env);
    }

    if (url.pathname === "/") {
      return Response.json({ ok: true, service: "ob-ai-api" });
    }

    return new Response("Not Found", { status: 404 });
  },
};
