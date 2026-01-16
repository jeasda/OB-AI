import type { Env } from "../env";
import { jsonResponse } from "../utils/http";
import { getQwenJob } from "../services/qwen_jobs.service";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function statusMessage(status: string) {
  if (status === "queued") return "Queued for processing";
  if (status === "processing") return "Processing prompt";
  if (status === "uploading") return "Uploading result";
  if (status === "done") return "Completed";
  return "Error";
}

export async function handleJobStatus(req: Request, env: Env, jobId: string) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const job = getQwenJob(jobId);
  if (!job) {
    return jsonResponse({ status: "error", message: "job not found" }, { status: 404, headers: corsHeaders() });
  }

  if (job.status === "done") {
    return jsonResponse({ status: "done", outputUrl: job.outputUrl }, { headers: corsHeaders() });
  }

  if (job.status === "error") {
    return jsonResponse({ status: "error", message: job.error || "generation failed" }, { headers: corsHeaders() });
  }

  return jsonResponse(
    {
      status: job.status === "queued" ? "processing" : job.status,
      progress: job.progress,
      message: statusMessage(job.status),
    },
    { headers: corsHeaders() }
  );
}
