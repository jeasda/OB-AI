import workflowTemplate from './image_qwen_image_edit_2509.json'

type Env = {
  RUNPOD_API_KEY: string
  RUNPOD_ENDPOINT: string
  RUNPOD_API_BASE?: string
  R2_PUBLIC_BASE?: string
  R2_PREFIX?: string
  ENVIRONMENT?: string
}

const RUNPOD_TIMEOUT_MS = 60_000
const RUNPOD_RETRIES = 2
const VERSION = '2026-01-17'
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

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function cloneWorkflow() {
  return JSON.parse(JSON.stringify(workflowTemplate))
}

function clonePayloadWorkflow(payload: Record<string, unknown>) {
  const candidate = (payload as any)?.workflow
  if (!candidate || typeof candidate !== 'object') return null
  return JSON.parse(JSON.stringify(candidate))
}

function setImageUrl(workflow: Record<string, any>, imageUrl: string) {
  for (const node of Object.values(workflow)) {
    const classType = asString(node?.class_type).toLowerCase()
    const inputs = node?.inputs
    if (!inputs || typeof inputs !== 'object') continue
    const hasUrl = typeof inputs.url === 'string'
    const hasImage = typeof inputs.image !== 'undefined'
    const hasPath = typeof inputs.path === 'string'
    if (classType.includes('loadimage') || (classType.includes('image') && (hasUrl || hasImage || hasPath))) {
      if ('url' in inputs) {
        inputs.url = imageUrl
      } else if ('image' in inputs) {
        inputs.image = imageUrl
      } else if ('path' in inputs) {
        inputs.path = imageUrl
      }
      return true
    }
  }
  return false
}

function setPromptText(workflow: Record<string, any>, prompt: string) {
  for (const node of Object.values(workflow)) {
    const classType = asString(node?.class_type).toLowerCase()
    const inputs = node?.inputs
    if (!inputs || typeof inputs !== 'object') continue
    const hasText = typeof inputs.text === 'string'
    const hasPrompt = typeof inputs.prompt === 'string'
    if (classType.includes('prompt') || (classType.includes('text') && hasText) || hasPrompt) {
      if ('text' in inputs) {
        inputs.text = prompt
      } else if ('prompt' in inputs) {
        inputs.prompt = prompt
      }
      return true
    }
  }
  return false
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

async function submitToRunPod(env: Env, payload: Record<string, unknown>, requestId?: string) {
  const apiKey = env.RUNPOD_API_KEY
  if (!apiKey) {
    emitLog('RUNPOD_SUBMIT_SKIPPED_NO_KEY', {
      requestId: requestId || 'unknown',
      timestamp: new Date().toISOString()
    })
    return {
      error: 'RUNPOD_API_KEY_MISSING',
      message: 'Submit Proxy is not configured with RUNPOD_API_KEY',
      status: 500
    }
  }
  if (!env.RUNPOD_ENDPOINT) {
    return {
      error: 'RUNPOD_ENDPOINT_MISSING',
      message: 'Submit Proxy is not configured with RUNPOD_ENDPOINT',
      status: 502
    }
  }
  if (!env.R2_PUBLIC_BASE) {
    return {
      error: 'R2_PUBLIC_BASE_MISSING',
      message: 'Submit Proxy is not configured with R2_PUBLIC_BASE',
      status: 400
    }
  }
  const url = `${runpodBase(env)}/${env.RUNPOD_ENDPOINT}/run`
  const workflow = clonePayloadWorkflow(payload) || cloneWorkflow()
  const prompt = typeof (payload as any)?.prompt === 'string' ? String((payload as any).prompt) : ''
  const r2Key = typeof (payload as any)?.r2_key === 'string' ? String((payload as any).r2_key) : ''
  if (!r2Key || !prompt) {
    return {
      error: 'INVALID_PAYLOAD',
      message: 'Submit Proxy expects payload.r2_key and prompt',
      status: 400
    }
  }
  if (!workflow || typeof workflow !== 'object') {
    return {
      error: 'INVALID_WORKFLOW',
      message: 'Submit Proxy workflow template is invalid',
      status: 400
    }
  }
  const imageUrl = `${env.R2_PUBLIC_BASE.replace(/\/+$/, '')}/${r2Key.replace(/^\/+/, '')}`
  const warnings: string[] = []
  if (!setImageUrl(workflow, imageUrl)) {
    warnings.push('image-node-not-found')
    emitLog('WORKFLOW_IMAGE_NODE_MISSING', {
      requestId: requestId || 'unknown',
      timestamp: new Date().toISOString()
    })
  }
  if (!setPromptText(workflow, prompt)) {
    warnings.push('prompt-node-not-found')
    emitLog('WORKFLOW_PROMPT_NODE_MISSING', {
      requestId: requestId || 'unknown',
      timestamp: new Date().toISOString()
    })
  }
  const width = Number((workflow as any)?.['2']?.inputs?.width) || 1024
  const height = Number((workflow as any)?.['2']?.inputs?.height) || 1536
  const ratio = typeof (payload as any)?.ratio === 'string' ? (payload as any).ratio : undefined
  const bodyText = JSON.stringify({
    input: {
      workflow,
      prompt,
      image_url: imageUrl,
      r2_key: r2Key,
      width,
      height,
      service: (payload as any)?.service || 'qwen-image-edit',
      requestId: requestId || (payload as any)?.requestId,
      ratio,
      mode: 'edit',
      meta: {
        source: 'ob-ai-submit-proxy',
        ts: new Date().toISOString()
      }
    }
  })
  emitLog('RUNPOD_SUBMIT_ATTEMPT', {
    requestId: requestId || 'unknown',
    endpoint: env.RUNPOD_ENDPOINT,
    payloadSize: bodyText.length,
    timestamp: new Date().toISOString()
  })

  let res: Response
  try {
    res = await runpodFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: bodyText
    })
  } catch (error: any) {
    emitLog('RUNPOD_SUBMIT_FAILED', {
      requestId: requestId || 'unknown',
      endpoint: env.RUNPOD_ENDPOINT,
      timestamp: new Date().toISOString(),
      error: error?.message || 'runpod fetch failed'
    })
    return {
      error: 'RUNPOD_FETCH_FAILED',
      message: error?.message || 'runpod fetch failed',
      status: 502
    }
  }
  const raw = await res.text()
  if (!res.ok) {
    emitLog('RUNPOD_RESPONSE_ERROR', {
      requestId: requestId || 'unknown',
      endpoint: env.RUNPOD_ENDPOINT,
      status: res.status,
      timestamp: new Date().toISOString(),
      bodyPreview: raw.slice(0, 512)
    })
    return {
      error: 'RUNPOD_RESPONSE_ERROR',
      message: raw || 'RunPod API error',
      status: res.status
    }
  }
  const jsonBody = JSON.parse(raw)
  const runpodId = jsonBody?.id || jsonBody?.job_id
  emitLog('RUNPOD_RESPONSE_OK', {
    requestId: requestId || 'unknown',
    endpoint: env.RUNPOD_ENDPOINT,
    status: res.status,
    timestamp: new Date().toISOString(),
    runpodJobId: runpodId || null
  })
  if (!runpodId) {
    emitLog('RUNPOD_RESPONSE_ERROR', {
      requestId: requestId || 'unknown',
      endpoint: env.RUNPOD_ENDPOINT,
      status: res.status,
      timestamp: new Date().toISOString(),
      bodyPreview: raw.slice(0, 512)
    })
    return {
      error: 'RUNPOD_RESPONSE_MISSING_JOB_ID',
      message: 'RunPod response missing job id',
      status: 502
    }
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
  return { ...jsonBody, warnings, image_url: imageUrl }
}

async function getRunPodStatus(env: Env, runpodId: string) {
  const apiKey = env.RUNPOD_API_KEY
  if (!apiKey) {
    return {
      error: 'RUNPOD_API_KEY_MISSING',
      message: 'Submit Proxy is not configured with RUNPOD_API_KEY',
      status: 500
    }
  }
  if (!env.RUNPOD_ENDPOINT) {
    return {
      error: 'RUNPOD_ENDPOINT_MISSING',
      message: 'Submit Proxy is not configured with RUNPOD_ENDPOINT',
      status: 502
    }
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
    emitLog('RUNPOD_RESPONSE_ERROR', {
      requestId: 'status',
      endpoint: env.RUNPOD_ENDPOINT,
      status: res.status,
      timestamp: new Date().toISOString(),
      bodyPreview: raw.slice(0, 512)
    })
    return {
      error: 'RUNPOD_STATUS_ERROR',
      message: raw || 'RunPod status error',
      status: res.status
    }
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
        return json({ status: 'ok' })
      }

      if (req.method === 'GET' && url.pathname === '/debug/env') {
        return json({
          ok: true,
          hasRunpodKey: !!env.RUNPOD_API_KEY,
          hasRunpodEndpoint: !!env.RUNPOD_ENDPOINT,
          hasR2Binding: !!env.R2_PUBLIC_BASE,
          version: VERSION,
          ts: new Date().toISOString()
        })
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
          trace_id: requestId,
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
        lastJob = {
          requestId,
          timestamp: new Date().toISOString(),
          runpodJobId: null,
          runpodEndpointId: env.RUNPOD_ENDPOINT
        }
        const run = await submitToRunPod(env, payload as Record<string, unknown>, requestId)
        if (run?.error) {
          return json({ error: run.error, message: run.message }, run.status || 500)
        }
        return json({
          ok: true,
          requestId,
          runpodJobId: run?.id || run?.job_id,
          runpodRequestId: run?.id || run?.job_id,
          image_url: run?.image_url,
          warnings: run?.warnings || []
        })
      }

      if (req.method === 'GET' && url.pathname.startsWith('/status/')) {
        const id = url.pathname.split('/').pop() || ''
        if (!id) return json({ error: 'missing runpod id' }, 400)
        const status = await getRunPodStatus(env, id)
        if (status?.error) {
          return json({ error: status.error, message: status.message }, status.status || 500)
        }
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
