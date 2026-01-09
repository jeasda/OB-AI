import { nanoid } from 'nanoid'

export interface Env {
  DB: D1Database
  ASSETS: R2Bucket
  RUNPOD_API_KEY: string
  RUNPOD_ENDPOINT_ID: string
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const formData = await ctx.request.formData()

    const file = formData.get('file') as File | null
    const prompt = formData.get('prompt') as string | null

    if (!file || !prompt) {
      return new Response(
        JSON.stringify({ error: 'file and prompt required' }),
        { status: 400 }
      )
    }

    // 1. Upload image to R2
    const imageId = nanoid()
    const r2Key = `inputs/${imageId}.png`

    await ctx.env.ASSETS.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type },
    })

    const inputImageUrl = `${new URL(ctx.request.url).origin}/api/image/${r2Key}`

    // 2. Insert job into D1
    const jobId = nanoid()

    await ctx.env.DB.prepare(
      `
      INSERT INTO jobs (
        id,
        status,
        input_image_url,
        prompt,
        created_at,
        updated_at
      )
      VALUES (?, 'PENDING', ?, ?, strftime('%s','now'), strftime('%s','now'))
      `
    ).bind(jobId, inputImageUrl, prompt).run()

    // 3. Call RunPod Serverless
    const runpodRes = await fetch(
      `https://api.runpod.ai/v2/${ctx.env.RUNPOD_ENDPOINT_ID}/run`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ctx.env.RUNPOD_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt,
            image_url: inputImageUrl,
            job_id: jobId,
          },
        }),
      }
    )

    const runpodData = await runpodRes.json()

    if (!runpodRes.ok) {
      throw new Error(runpodData?.error || 'RunPod request failed')
    }

    const runpodJobId = runpodData.id

    // 4. Update D1 with runpod id
    await ctx.env.DB.prepare(
      `
      UPDATE jobs
      SET runpod_id = ?, updated_at = strftime('%s','now')
      WHERE id = ?
      `
    ).bind(runpodJobId, jobId).run()

    return new Response(
      JSON.stringify({ jobId }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500 }
    )
  }
}
