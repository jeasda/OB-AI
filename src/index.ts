import { Router } from "itty-router";
import runpodRoutes from "./routes/runpod";
import pollRoutes from "./routes/runpod-poll";

const router = Router();

router.all("*", runpodRoutes.handle);
router.all("*", pollRoutes.handle);

router.get("/", () =>
  new Response(
    JSON.stringify({ ok: true, service: "ob-ai-api", status: "running" }),
    { headers: { "Content-Type": "application/json" } }
  )
);

export default {
  fetch: (request, env, ctx) => router.handle(request, env, ctx),
};
