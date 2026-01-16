type Env = {
  RUNPOD_API_KEY: string
  RUNPOD_ENDPOINT: string
  RUNPOD_API_BASE?: string
  ENVIRONMENT?: string
}

const RUNPOD_TIMEOUT_MS = 60_000
const RUNPOD_RETRIES = 2

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    }
  })
}

async function runpodFetch(url: string, init: RequestInit) {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= RUNPOD_RETRIES + 1; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort('timeout'), RUNPOD_TIMEOUT_MS)
    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timeout)
      return res
    } catch (error) {
      clearTimeout(timeout)
      lastError = error
      if (attempt <= RUNPOD_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
      }
    }
  }
  throw lastError || new Error('RunPod request failed')
}

function runpodBase(env: Env) {
  return (env.RUNPOD_API_BASE || 'https://api.runpod.ai/v2').replace(/\/$/, '')
}

async function submitToRunPod(env: Env, payload: Record<string, unknown>, apiKeyOverride?: string) {
  const apiKey = apiKeyOverride || env.RUNPOD_API_KEY
  if (!apiKey) {
    throw new Error('RUNPOD_API_KEY is not set')
  }
  if (!env.RUNPOD_ENDPOINT) {
    throw new Error('RUNPOD_ENDPOINT is not set')
  }
  const url = `${runpodBase(env)}/${env.RUNPOD_ENDPOINT}/run`
  const bodyText = JSON.stringify({ input: payload })
  console.log(JSON.stringify({
    level: 'info',
    event: 'RUNPOD_SUBMIT_ATTEMPT',
    endpoint: env.RUNPOD_ENDPOINT,
    payloadSize: bodyText.length,
    timestamp: new Date().toISOString()
  }))

  const res = await runpodFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: bodyText
  })
  const raw = await res.text()
  if (!res.ok) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'RUNPOD_RESPONSE_ERROR',
      endpoint: env.RUNPOD_ENDPOINT,
      status: res.status,
      timestamp: new Date().toISOString(),
      bodyPreview: raw.slice(0, 512)
    }))
    throw new Error(raw || 'RunPod API error')
  }
  console.log(JSON.stringify({
    level: 'info',
    event: 'RUNPOD_RESPONSE_OK',
    endpoint: env.RUNPOD_ENDPOINT,
    status: res.status,
    timestamp: new Date().toISOString()
  }))
  const jsonBody = JSON.parse(raw)
  const runpodId = jsonBody?.id || jsonBody?.job_id
  if (!runpodId) {
    throw new Error('RunPod response missing job id')
  }
  console.log(JSON.stringify({
    level: 'info',
    event: 'NEW_JOB_SUBMITTED',
    jobId: jsonBody?.id || jsonBody?.job_id,
    runpodRequestId: runpodId,
    timestamp: new Date().toISOString()
  }))
  return jsonBody
}

async function getRunPodStatus(env: Env, runpodId: string, apiKeyOverride?: string) {
  const apiKey = apiKeyOverride || env.RUNPOD_API_KEY
  if (!apiKey) {
    throw new Error('RUNPOD_API_KEY is not set')
  }
  if (!env.RUNPOD_ENDPOINT) {
    throw new Error('RUNPOD_ENDPOINT is not set')
  }
  const url = `${runpodBase(env)}/${env.RUNPOD_ENDPOINT}/status/${runpodId}`
  const res = await runpodFetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  })
  const raw = await res.text()
  if (!res.ok) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'RUNPOD_RESPONSE_ERROR',
      endpoint: env.RUNPOD_ENDPOINT,
      status: res.status,
      timestamp: new Date().toISOString(),
      bodyPreview: raw.slice(0, 512)
    }))
    throw new Error(raw || 'RunPod status error')
  }
  return JSON.parse(raw)
}

export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url)
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*'
        }
      })
    }

    try {
      if (req.method === 'POST' && url.pathname === '/submit') {
        console.log(JSON.stringify({
          level: 'info',
          event: 'SUBMIT_PROXY_RECEIVED',
          timestamp: new Date().toISOString()
        }))
        const raw = await req.text()
        if (!raw) return json({ error: 'empty body' }, 400)
        let payload: unknown
        try {
          payload = JSON.parse(raw)
        } catch (error: any) {
          return json({ error: error?.message || 'invalid json' }, 400)
        }
        const authHeader = req.headers.get('authorization') || ''
        const bearerKey = authHeader.toLowerCase().startsWith('bearer ')
          ? authHeader.slice(7).trim()
          : ''
        const apiKey = bearerKey || req.headers.get('x-runpod-api-key') || undefined
        console.log(JSON.stringify({
          level: 'info',
          event: 'SUBMIT_PROXY_AUTH',
          timestamp: new Date().toISOString(),
          apiKeyLength: apiKey ? apiKey.length : 0
        }))
        const run = await submitToRunPod(env, payload as Record<string, unknown>, apiKey)
        return json({
          jobId: run?.id || run?.job_id,
          runpodRequestId: run?.id || run?.job_id
        })
      }

      if (req.method === 'GET' && url.pathname.startsWith('/status/')) {
        const id = url.pathname.split('/').pop() || ''
        if (!id) return json({ error: 'missing runpod id' }, 400)
        const authHeader = req.headers.get('authorization') || ''
        const bearerKey = authHeader.toLowerCase().startsWith('bearer ')
          ? authHeader.slice(7).trim()
          : ''
        const apiKey = bearerKey || req.headers.get('x-runpod-api-key') || undefined
        const status = await getRunPodStatus(env, id, apiKey)
        return json({ status })
      }

      return json({ error: 'Not Found' }, 404)
    } catch (error: any) {
      console.error(JSON.stringify({
        level: 'error',
        event: 'RUNPOD_RESPONSE_ERROR',
        errorMessage: error?.message || 'submit proxy error',
        timestamp: new Date().toISOString()
      }))
      return json({ error: error?.message || 'submit proxy error' }, 500)
    }
  }
}
