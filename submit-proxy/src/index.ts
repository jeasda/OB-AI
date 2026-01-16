type Env = {
  RUNPOD_API_KEY: string
  RUNPOD_ENDPOINT: string
  RUNPOD_API_BASE?: string
  ENVIRONMENT?: string
}

const RUNPOD_TIMEOUT_MS = 60_000
const RUNPOD_RETRIES = 2
let lastJob: {
  requestId: string
  timestamp: string
  runpodJobId: string | null
  runpodEndpointId: string | null
} | null = null
let lastLogs: string[] = []

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

function emitLog(event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify({ event, ...fields })
  console.log(line)
  lastLogs = [...lastLogs.slice(-9), line]
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

async function submitToRunPod(env: Env, payload: Record<string, unknown>, apiKeyOverride?: string, requestId?: string) {
  const apiKey = apiKeyOverride || env.RUNPOD_API_KEY
  if (!apiKey) {
    emitLog('RUNPOD_SUBMIT_FAIL_NO_KEY', {
      requestId: requestId || 'unknown',
      timestamp: new Date().toISOString()
    })
    throw new Error('RUNPOD_API_KEY is not set')
  }
  if (!env.RUNPOD_ENDPOINT) {
    throw new Error('RUNPOD_ENDPOINT is not set')
  }
  const url = `${runpodBase(env)}/${env.RUNPOD_ENDPOINT}/run`
  const bodyText = JSON.stringify({ input: payload })
  emitLog('RUNPOD_SUBMIT_ATTEMPT', {
    requestId: requestId || 'unknown',
    endpoint: env.RUNPOD_ENDPOINT,
    payloadSize: bodyText.length,
    timestamp: new Date().toISOString()
  })

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
    emitLog('RUNPOD_RESPONSE_ERROR', {
      endpoint: env.RUNPOD_ENDPOINT,
      status: res.status,
      timestamp: new Date().toISOString(),
      bodyPreview: raw.slice(0, 512)
    })
    throw new Error(raw || 'RunPod API error')
  }
  emitLog('RUNPOD_RESPONSE_OK', {
    requestId: requestId || 'unknown',
    endpoint: env.RUNPOD_ENDPOINT,
    status: res.status,
    timestamp: new Date().toISOString()
  })
  const jsonBody = JSON.parse(raw)
  const runpodId = jsonBody?.id || jsonBody?.job_id
  if (!runpodId) {
    throw new Error('RunPod response missing job id')
  }
  emitLog('NEW_JOB_SUBMITTED', {
    requestId: requestId || 'unknown',
    runpodJobId: runpodId,
    runpodEndpointId: env.RUNPOD_ENDPOINT,
    timestamp: new Date().toISOString()
  })
  lastJob = {
    requestId: lastJob?.requestId || 'unknown',
    timestamp: new Date().toISOString(),
    runpodJobId: runpodId,
    runpodEndpointId: env.RUNPOD_ENDPOINT
  }
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
      if (req.method === 'GET' && url.pathname === '/health') {
        return json({ status: 'ok', timestamp: new Date().toISOString() })
      }

      if (req.method === 'GET' && url.pathname === '/debug/last-job') {
        return json({
          requestId: lastJob?.requestId || null,
          timestamp: lastJob?.timestamp || null,
          runpodJobId: lastJob?.runpodJobId || null,
          logs: lastLogs
        })
      }

      if (req.method === 'POST' && url.pathname === '/submit') {
        const requestId = req.headers.get('x-request-id') || crypto.randomUUID()
        const source = req.headers.get('x-ob-source') || 'unknown'
        emitLog('SUBMIT_PROXY_RECEIVED', {
          timestamp: new Date().toISOString(),
          requestId,
          path: url.pathname,
          source
        })
        const raw = await req.text()
        if (!raw) {
          emitLog('SUBMIT_PROXY_VALIDATE_FAIL', {
            timestamp: new Date().toISOString(),
            requestId,
            reason: 'empty body'
          })
          return json({ error: 'empty body' }, 400)
        }
        let payload: unknown
        try {
          payload = JSON.parse(raw)
        } catch (error: any) {
          emitLog('SUBMIT_PROXY_VALIDATE_FAIL', {
            timestamp: new Date().toISOString(),
            requestId,
            reason: error?.message || 'invalid json'
          })
          return json({ error: error?.message || 'invalid json' }, 400)
        }
        emitLog('SUBMIT_PROXY_VALIDATE_OK', {
          timestamp: new Date().toISOString(),
          requestId
        })
        const authHeader = req.headers.get('authorization') || ''
        const bearerKey = authHeader.toLowerCase().startsWith('bearer ')
          ? authHeader.slice(7).trim()
          : ''
        const apiKey = bearerKey || req.headers.get('x-runpod-api-key') || undefined
        emitLog('SUBMIT_PROXY_AUTH', {
          timestamp: new Date().toISOString(),
          requestId,
          apiKeyLength: apiKey ? apiKey.length : 0
        })
        lastJob = {
          requestId,
          timestamp: new Date().toISOString(),
          runpodJobId: null,
          runpodEndpointId: env.RUNPOD_ENDPOINT
        }
        const run = await submitToRunPod(env, payload as Record<string, unknown>, apiKey, requestId)
        return json({
          requestId,
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
      emitLog('RUNPOD_RESPONSE_ERROR', {
        errorMessage: error?.message || 'submit proxy error',
        timestamp: new Date().toISOString()
      })
      return json({ error: error?.message || 'submit proxy error', logs: lastLogs }, 500)
    }
  }
}
