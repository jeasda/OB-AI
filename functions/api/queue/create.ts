import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequestPost: PagesFunction = async ({ request }) => {
  const body = await request.json();

  return new Response(
    JSON.stringify({
      ok: true,
      received: body,
    }),
    {
      headers: {
        "content-type": "application/json",
      },
    }
  );
};
