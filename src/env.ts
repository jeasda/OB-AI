export interface Env {
  DB: D1Database;
  R2_RESULTS: R2Bucket;
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
  ALLOWED_ORIGINS?: string;
  R2_PREFIX?: string;
}
