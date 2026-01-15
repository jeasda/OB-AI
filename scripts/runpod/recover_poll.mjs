import https from 'node:https'

const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY
const RUNPOD_ENDPOINT = process.env.RUNPOD_ENDPOINT_ID || process.env.RUNPOD_ENDPOINT
const RUNPOD_BASE_URL = process.env.RUNPOD_BASE_URL || 'https://api.runpod.ai/v2'
const RUNPOD_JOB_ID = process.env.RUNPOD_JOB_ID
const WORKER_BASE_URL = process.env.WORKER_BASE_URL
const WEBHOOK_SECRET = process.env.RUNPOD_WEBHOOK_SECRET

if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT || !RUNPOD_JOB_ID || !WORKER_BASE_URL || !WEBHOOK_SECRET) {
  console.error('Usage: RUNPOD_API_KEY=... RUNPOD_ENDPOINT_ID=... RUNPOD_JOB_ID=... WORKER_BASE_URL=... RUNPOD_WEBHOOK_SECRET=... node scripts/runpod/recover_poll.mjs')
  process.exit(1)
}

function fetchJson(url, options) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), raw: data })
        } catch (err) {
          reject(new Error(`Non-JSON response: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    if (options?.body) req.write(options.body)
    req.end()
  })
}

async function main() {
  const statusUrl = `${RUNPOD_BASE_URL}/${RUNPOD_ENDPOINT}/status/${RUNPOD_JOB_ID}`
  const statusRes = await fetchJson(statusUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` }
  })

  if (statusRes.status !== 200) {
    console.error('RunPod status failed:', statusRes.raw)
    process.exit(1)
  }

  const payload = statusRes.body
  const webhookUrl = `${WORKER_BASE_URL.replace(/\/$/, '')}/api/runpod/webhook`
  const webhookBody = JSON.stringify(payload)

  const webhookRes = await fetchJson(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-runpod-webhook-secret': WEBHOOK_SECRET
    },
    body: webhookBody
  })

  console.log('[Recovery] Webhook status:', webhookRes.status)
  console.log('[Recovery] Response:', JSON.stringify(webhookRes.body, null, 2))
}

main().catch((err) => {
  console.error('[Recovery] Error:', err.message || err)
  process.exit(1)
})
