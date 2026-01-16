import type { Env } from "../env";
import { jsonResponse } from "../utils/http";
import { getQwenJob, updateQwenJob } from "../services/qwen_jobs.service";
import { getPublicUrlForKey, putPngBytesWithKey } from "../services/r2.service";
import { logEvent } from "../utils/log";

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

  const job = await getQwenJob(env, jobId);
  if (!job) {
    return jsonResponse({ status: "error", message: "job not found" }, { status: 404, headers: corsHeaders() });
  }

  if (job.status === "done") {
    return jsonResponse({ status: "done", outputUrl: job.outputUrl }, { headers: corsHeaders() });
  }

  if (job.status === "error") {
    return jsonResponse({ status: "error", message: job.error || "generation failed" }, { headers: corsHeaders() });
  }

  if (job.runpodId) {
    try {
      if (!env.SUBMIT_PROXY_URL) {
        throw new Error("SUBMIT_PROXY_URL is not set");
      }
      logEvent("info", "JOB_STATUS_POLL", {
        jobId,
        runpodId: job.runpodId,
        endpoint: env.SUBMIT_PROXY_URL,
        timestamp: new Date().toISOString(),
      });
      const proxyRes = await fetch(
        `${env.SUBMIT_PROXY_URL.replace(/\/$/, "")}/status/${encodeURIComponent(job.runpodId)}`,
        {
          headers: {
            Authorization: env.RUNPOD_API_KEY ? `Bearer ${env.RUNPOD_API_KEY}` : "",
          },
        }
      );
      const proxyText = await proxyRes.text();
      if (!proxyRes.ok) {
        throw new Error(proxyText || "Submit proxy status failed");
      }
      const proxyJson = JSON.parse(proxyText);
      const run = proxyJson?.status;
      const status = String(run?.status || "").toUpperCase();

      if (status === "COMPLETED" || status === "SUCCESS") {
        await updateQwenJob(env, jobId, { status: "uploading", progress: 90 });
        const output = run?.output ?? run?.result ?? run;
        const base64 =
          typeof output?.image_base64 === "string"
            ? output.image_base64
            : typeof output?.image === "string"
              ? output.image
              : typeof output?.images?.[0]?.base64 === "string"
                ? output.images[0].base64
                : typeof output?.images?.[0] === "string"
                  ? output.images[0]
                  : null;
        let bytes: Uint8Array | null = null;
        if (base64) {
          const raw = base64.includes(",") ? base64.split(",").pop() || "" : base64;
          const binary = atob(raw);
          const buffer = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            buffer[i] = binary.charCodeAt(i);
          }
          bytes = buffer;
        } else {
          const url =
            typeof output?.url === "string"
              ? output.url
              : typeof output?.image_url === "string"
                ? output.image_url
                : typeof output?.result_url === "string"
                  ? output.result_url
                  : typeof output?.images?.[0]?.url === "string"
                    ? output.images[0].url
                    : typeof output?.images?.[0] === "string"
                      ? output.images[0]
                      : null;
          if (url) {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`RunPod output fetch failed: ${res.status}`);
            const arrayBuffer = await res.arrayBuffer();
            bytes = new Uint8Array(arrayBuffer);
          }
        }

        if (!bytes) {
          throw new Error("RunPod output missing image data");
        }

        const key = `qwen-image-edit/${jobId}.png`;
        await putPngBytesWithKey(env, key, bytes);
        const outputUrl = getPublicUrlForKey(env, key);
        await updateQwenJob(env, jobId, { status: "done", progress: 100, outputUrl });
        return jsonResponse({ status: "done", outputUrl }, { headers: corsHeaders() });
      }

      if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
        const message = run?.error || run?.message || "RunPod failed";
        await updateQwenJob(env, jobId, { status: "error", progress: 0, error: String(message) });
        return jsonResponse({ status: "error", message: String(message) }, { headers: corsHeaders() });
      }

      const progress = typeof run?.progress === "number" ? Math.round(run.progress) : 50;
      await updateQwenJob(env, jobId, { status: "processing", progress });
      return jsonResponse(
        {
          status: "processing",
          progress,
          message: statusMessage("processing"),
        },
        { headers: corsHeaders() }
      );
    } catch (error: any) {
      await updateQwenJob(env, jobId, {
        status: "error",
        progress: 0,
        error: error?.message || "RunPod status failed",
      });
      return jsonResponse(
        { status: "error", message: error?.message || "RunPod status failed" },
        { headers: corsHeaders() }
      );
    }
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
