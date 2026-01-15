
interface CloudflareEnv {
    DB: D1Database;
    R2_RESULTS: R2Bucket;
    R2_PREFIX: string;
    RUNPOD_API_KEY: string;
    RUNPOD_ENDPOINT: string;
    RUNPOD_WEBHOOK_SECRET?: string;
    RUNPOD_WEBHOOK_ENABLED?: string;
    RUNPOD_WEBHOOK_FALLBACK?: string;
    WORKFLOW_VERSION?: string;
    WORKER_IMAGE_TAG?: string;
    COST_PER_JOB_USD?: string;
    ENVIRONMENT?: string;
}

declare global {
    interface ProcessEnv extends CloudflareEnv { }
}
