import { buildPrompt, generateImage } from '../../lib/qwen'
import { createJob, updateJob } from '../../lib/jobStore'
import { uploadResult } from '../../lib/r2'

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': '*'
    }
  })
}

function normalizePresets(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String)
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean)
    }
  }
  return []
}

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true'
  return false
}

function decodeBase64Image(raw: string) {
  const cleaned = raw.includes(',') ? raw.split(',').pop() || '' : raw
  const binary = atob(cleaned)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function parseRequest(request: Request) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body = await request.json()
    const image = body?.image ? decodeBase64Image(String(body.image)) : null
    return {
      image,
      prompt: String(body?.prompt || ''),
      presets: normalizePresets(body?.presets),
      options: body?.options && typeof body.options === 'object' ? body.options : {},
      reuse: parseBoolean(body?.reuse)
    }
  }

  const formData = await request.formData()
  const file = formData.get('image')
  const image = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : null
  const presets = normalizePresets(formData.get('presets'))
  const optionsRaw = formData.get('options')
  let options: Record<string, unknown> = {}
  if (typeof optionsRaw === 'string') {
    try {
      const parsed = JSON.parse(optionsRaw)
      if (parsed && typeof parsed === 'object') options = parsed
    } catch {
      options = {}
    }
  }

  return {
    image,
    prompt: String(formData.get('prompt') || ''),
    presets,
    options,
    reuse: parseBoolean(formData.get('reuse'))
  }
}

async function processJob(env: any, jobId: string, payload: any) {
  const { image, prompt, presets, options } = payload

  await updateJob(env, jobId, { status: 'processing', progress: 20 })

  const finalPrompt = buildPrompt(
    'Apply clean, realistic edits while preserving identity and lighting.',
    prompt,
    presets,
    options
  )

  const output = await generateImage({ image, prompt: finalPrompt })

  await updateJob(env, jobId, { status: 'uploading', progress: 90 })

  const outputUrl = await uploadResult(env, jobId, output)

  await updateJob(env, jobId, { status: 'done', progress: 100, outputUrl })
}

export async function onRequestOptions() {
  return jsonResponse({}, 204)
}

export async function onRequestPost(context: any) {
  const { request, env } = context

  try {
    const payload = await parseRequest(request)

    if (!payload.image) {
      return jsonResponse({ error: 'image is required' }, 400)
    }
    if (!payload.prompt) {
      return jsonResponse({ error: 'prompt is required' }, 400)
    }

    const job = await createJob(env)

    context.waitUntil(
      processJob(env, job.jobId, payload).catch(async (error) => {
        await updateJob(env, job.jobId, {
          status: 'error',
          progress: 0,
          error: error?.message || 'generation failed'
        })
      })
    )

    return jsonResponse({ jobId: job.jobId })
  } catch (error: any) {
    return jsonResponse({ error: error?.message || 'invalid request' }, 400)
  }
}
