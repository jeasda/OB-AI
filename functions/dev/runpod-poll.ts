import { pollRunpod } from "../worker/runpod/poll";

export const onRequestPost: PagesFunction = async ({ env }) => {
  const result = await pollRunpod(env);
  return new Response(JSON.stringify({ ok: true, result }), {
    headers: { "content-type": "application/json" },
  });
};