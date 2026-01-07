import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequest: PagesFunction = async (context) => {
  const { params } = context;

  return new Response(
    JSON.stringify({
      ok: true,
      id: params?.id,
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    }
  );
};
