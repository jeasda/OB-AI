import { handleQueueCreate } from "./routes/queue";
import { handleRunpodPoll } from "./routes/runpod-poll";

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname === "/api/queue/create") {
      return handleQueueCreate(req, env);
    }

    if (req.method === "GET" && url.pathname === "/api/runpod/poll") {
      return handleRunpodPoll(req, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};
