export type QwenJobStatus = "queued" | "processing" | "uploading" | "done" | "error";

export type QwenJob = {
  jobId: string;
  status: QwenJobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  outputUrl?: string;
  error?: string;
};

const jobs = new Map<string, QwenJob>();

function nowIso() {
  return new Date().toISOString();
}

export function createQwenJob(): QwenJob {
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
  return job;
}

export function getQwenJob(jobId: string): QwenJob | null {
  return jobs.get(jobId) || null;
}

export function updateQwenJob(jobId: string, updates: Partial<QwenJob>): QwenJob | null {
  const existing = jobs.get(jobId);
  if (!existing) return null;
  const next: QwenJob = {
    ...existing,
    ...updates,
    updatedAt: nowIso(),
  };
  jobs.set(jobId, next);
  return next;
}
