export const onRequestGet = async (context: any) => {
  const { env } = context;

  const response = {
    status: "ok",
    timestamp: new Date().toISOString(),
    runpod: {
      hasKey: "RUNPOD_API_KEY" in env,
      endpoint: env?.RUNPOD_ENDPOINT_ID ? "OK" : "MISSING",
    },
    bindings: {
      d1: !!env?.DB,
      r2: !!env?.IMAGES_BUCKET,
    },
  };

  return new Response(JSON.stringify(response, null, 2), {
    headers: {
      "content-type": "application/json",
    },
  });
};
