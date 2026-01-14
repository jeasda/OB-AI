import { handleQueueCreate } from "./routes/queue";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "POST" && url.pathname === "/api/queue/create") {
        return handleQueueCreate(request, env);
      }

      return new Response(
        JSON.stringify({ ok: true, service: "ob-ai-api", status: "running" }),
        { headers: { "content-type": "application/json" } }
      );
    } catch (err: any) {
      console.error("FATAL", err);
      return new Response(
        JSON.stringify({ ok: false, error: err?.message || "internal error" }),
        { status: 500 }
      );
    }
  },
};
