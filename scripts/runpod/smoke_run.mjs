import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const API_KEY = process.env.RUNPOD_API_KEY
const ENDPOINT = process.env.RUNPOD_ENDPOINT_ID || process.env.RUNPOD_ENDPOINT
const BASE_URL = process.env.RUNPOD_BASE_URL || 'https://api.runpod.ai/v2'
const LABEL = process.env.RUNPOD_TARGET || 'staging'

if (!API_KEY || !ENDPOINT) {
  console.error('Usage: RUNPOD_API_KEY=... RUNPOD_ENDPOINT_ID=... node scripts/runpod/smoke_run.mjs')
  process.exit(1)
}

const workflowPath = path.join(__dirname, '..', '..', 'src', 'lib', 'workflow_template.json')
const targetFileName = 'smoke_input.png'

const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKwftQAAAABJRU5ErkJggg=='

function redactSecrets(obj) {
  const clone = JSON.parse(JSON.stringify(obj))
  if (clone?.headers?.Authorization) clone.headers.Authorization = '***'
  return clone
}

async function loadWorkflow() {
  const raw = await fs.readFile(workflowPath, 'utf8')
  const workflow = JSON.parse(raw)
  for (const nodeId of Object.keys(workflow)) {
    const node = workflow[nodeId]
    if (node?.class_type === 'LoadImage' && node?.inputs?.image) {
      node.inputs.image = targetFileName
    }
  }
  return workflow
}

async function main() {
  const workflow = await loadWorkflow()
  const traceId = crypto.randomUUID()

  const payload = {
    input: {
      workflow,
      images: [
        { name: targetFileName, image: tinyPngBase64 }
      ]
    }
  }

  const url = `${BASE_URL}/${ENDPOINT}/run`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
    'x-request-id': traceId
  }

  console.log('[RunPod Smoke] Target:', LABEL)
  console.log('[RunPod Smoke] Trace ID:', traceId)
  console.log('[RunPod Smoke] Request:', JSON.stringify(redactSecrets({ url, headers }), null, 2))

  const startedAt = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  const elapsedMs = Date.now() - startedAt
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }

  if (!res.ok) {
    console.error(`[RunPod Smoke] Failed: ${res.status}`)
    console.error(text.slice(0, 1000))
    process.exit(1)
  }

  console.log('[RunPod Smoke] Status:', res.status)
  console.log('[RunPod Smoke] Duration ms:', elapsedMs)
  console.log('[RunPod Smoke] Response:', JSON.stringify(json || { raw: text.slice(0, 1000) }, null, 2))
}

main().catch((error) => {
  console.error('[RunPod Smoke] Error:', error.message || error)
  process.exit(1)
})
