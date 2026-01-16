export async function handleRunpod(request: Request, env: any) {
  return new Response("Deprecated: submit proxy only", { status: 410 })
}

export async function runpodGetStatus(...args: any): Promise<any> {
  throw new Error("Deprecated: submit proxy only")
}
