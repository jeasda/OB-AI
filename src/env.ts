export interface Env {
  DB: D1Database;
  R2_RESULTS: R2Bucket;
  R2_PREFIX: string;
  R2_PUBLIC_BASE?: string;
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT: string;
  RUNPOD_MODE?: "workflow" | "prompt";
  RUNPOD_WEBHOOK_SECRET?: string;
  RUNPOD_WEBHOOK_ENABLED?: string;
  RUNPOD_WEBHOOK_FALLBACK?: string;
  WORKFLOW_VERSION?: string;
  WORKER_IMAGE_TAG?: string;
  COST_PER_JOB_USD?: string;
  ENVIRONMENT?: string;
}
