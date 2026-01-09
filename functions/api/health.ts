import type { PagesFunction } from "@cloudflare/workers-types";

type HealthResponse = {
  status: "ok";
  timestamp: string;
  runpod: {
    hasKey: boolean;
    endpoint: "OK" | "MISSING";
  };
  bindings: {
    d1: boolean;
    r2: boolean;
  };
};

export const onRequestGet: PagesFunction = async ({ env }) => {
  // ✅ ตรวจว่ามี key อยู่ไหม โดยไม่อ่านค่า secret
  const hasRunpodKey = "RUNPOD_API_KEY" in env;

  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    runpod: {
      hasKey: hasRunpodKey,
      endpoint: (env as any).RUNPOD_ENDPOINT_ID ? "OK" : "MISSING",
    },
    bindings: {
      d1: !!(env as any).DB,
      r2: !!(env as any).IMAGES_BUCKET,
    },
  };

  return new Response(JSON.stringify(response, null, 2), {
    headers: {
      "content-type": "application/json",
    },
  });
};
