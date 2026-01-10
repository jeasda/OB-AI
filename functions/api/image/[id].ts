export async function onRequest(context: any) {
  const { params } = context;

  return new Response(
    JSON.stringify({
      ok: true,
      id: params.id
    }),
    {
      headers: {
        "content-type": "application/json"
      }
    }
  );
}
