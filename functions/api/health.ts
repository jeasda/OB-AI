interface Env {
  RUNPOD_API_KEY: string;
  RUNPOD_ENDPOINT_ID: string;
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return new Response(
    JSON.stringify(
      {
        status: "ok",
        hasRunpodKey: !!env.RUNPOD_API_KEY,
        runpodEndpoint: env.RUNPOD_ENDPOINT_ID ? "OK" : "MISSING",
        d1: !!env.DB,
        r2: !!env.IMAGES_BUCKET,
      },
      null,
      2
    ),
    {
      headers: {
        "content-type": "application/json",
      },
    }
  );
};
