import runpodHandler from "./routes/runpod";
import pollHandler from "./routes/runpod-poll";

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        JSON.stringify({ ok: true, service: "ob-ai-api", status: "running" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/api/queue/create") {
      return runpodHandler(request, env);
    }

    if (url.pathname === "/api/runpod/poll") {
      return pollHandler(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};
