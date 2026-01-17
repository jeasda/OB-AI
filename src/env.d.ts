export interface Env {
  DB: D1Database;
  R2_RESULTS: R2Bucket;
  R2_PREFIX: string;
  RUNPOD_API_KEY?: string;
  RUNPOD_ENDPOINT: string;
  RUNPOD_MODE?: "workflow" | "prompt";
  ENVIRONMENT?: string;
  SUBMIT_PROXY?: Fetcher;
}
