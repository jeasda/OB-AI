export const onRequest: PagesFunction = async ({ params }) => {
  return new Response(
    JSON.stringify({
      ok: true,
      id: params.id,
      runtime: "cloudflare-pages",
    }),
    {
      headers: { "content-type": "application/json" },
    }
  );
};
