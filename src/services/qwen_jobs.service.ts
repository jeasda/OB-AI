import type { Env } from "../env";

export type QwenJobStatus = "queued" | "processing" | "uploading" | "done" | "error";

export type QwenJob = {
  jobId: string;
  runpodId?: string | null;
  status: QwenJobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  outputUrl?: string;
  error?: string;
};

const jobs = new Map<string, QwenJob>();
const JOB_PREFIX = "qwen-image-edit/jobs";

function nowIso() {
  return new Date().toISOString();
}

function jobKey(jobId: string) {
  return `${JOB_PREFIX}/${jobId}.json`;
}

async function persistJob(env: Env, job: QwenJob) {
  await env.R2_RESULTS.put(jobKey(job.jobId), JSON.stringify(job), {
    httpMetadata: { contentType: "application/json" },
  });
}

export async function createQwenJob(env: Env): Promise<QwenJob> {
  const jobId = crypto.randomUUID();
  const createdAt = nowIso();
  const job: QwenJob = {
    jobId,
    status: "queued",
    progress: 5,
    createdAt,
    updatedAt: createdAt,
  };
  jobs.set(jobId, job);
  await persistJob(env, job);
  return job;
}

export async function getQwenJob(env: Env, jobId: string): Promise<QwenJob | null> {
  const cached = jobs.get(jobId);
  if (cached) return cached;

  const obj = await env.R2_RESULTS.get(jobKey(jobId));
  if (!obj) return null;
  const text = await obj.text();
  const parsed = JSON.parse(text) as QwenJob;
  jobs.set(jobId, parsed);
  return parsed;
}

export async function updateQwenJob(env: Env, jobId: string, updates: Partial<QwenJob>): Promise<QwenJob | null> {
  const existing = await getQwenJob(env, jobId);
  if (!existing) return null;
  const next: QwenJob = {
    ...existing,
    ...updates,
    updatedAt: nowIso(),
  };
  jobs.set(jobId, next);
  await persistJob(env, next);
  return next;
}
