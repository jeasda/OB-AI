import {
  getRunPodStatus,
  extractOutputImageUrl,
} from "../services/runpod.service";

export async function handleRunpodPoll(req: Request, env: Env) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("id");

  if (!jobId) {
    return new Response("Missing job id", { status: 400 });
  }

  const status = await getRunPodStatus(env, jobId);
  const imageUrl = extractOutputImageUrl(status);

  return new Response(
    JSON.stringify({
      ok: true,
      status,
      imageUrl,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
