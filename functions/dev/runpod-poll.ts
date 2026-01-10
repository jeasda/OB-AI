import { pollRunpod } from "../../worker/runpod/poll"

export async function onRequestPost({ env }: any) {
  const result = await pollRunpod(env)
  return Response.json(result)
}
