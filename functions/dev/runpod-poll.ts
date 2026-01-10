import { pollRunpod } from "../worker/runpod/poll";

export const onRequestPost = async ({ env }: any) => {
  const result = await pollRunpod(env);

  return new Response(JSON.stringify(result), {
    headers: { "content-type": "application/json" },
  });
};
