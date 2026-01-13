import { Env } from "../env";
import {
  getRunPodStatus,
  extractOutputImageUrl,
} from "../services/runpod.service";

export async function handlePoll(
  req: Request,
  env: Env
): Promise<Response> {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return Response.json({ ok: false, error: "Missing jobId" }, { status: 400 });
  }

  const status = await getRunPodStatus(env, jobId);

  if (status.status !== "COMPLETED") {
    return Response.json({ ok: true, status: status.status });
  }

  const imageUrl = extractOutputImageUrl(status);
  if (!imageUrl) {
    return Response.json({ ok: false, error: "No output image" });
  }

  return Response.json({
    ok: true,
    status: "completed",
    image: imageUrl,
  });
}
