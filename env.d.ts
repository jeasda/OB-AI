
interface CloudflareEnv {
    DB: D1Database;
    IMAGES_BUCKET: R2Bucket;
    RUNPOD_API_KEY: string;
    RUNPOD_ENDPOINT_ID: string;
}

declare global {
    interface ProcessEnv extends CloudflareEnv { }
}
