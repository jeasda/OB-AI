import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_BASE_URL = 'http://127.0.0.1:8788'
const DEFAULT_CREATE_PATH = '/api/qwen-image-edit/create'
const DEFAULT_STATUS_PATH = '/api/qwen-image-edit/status'
const DEFAULT_DOWNLOAD_PATH = '/api/qwen-image-edit/download'
const DEFAULT_IMAGE_PATH = path.join(__dirname, 'input.png')
const DEFAULT_TIMEOUT_MS = 12 * 60 * 1000
const DEFAULT_POLL_INTERVAL_MS = 3000
const DEFAULT_MAX_LATENCY_MS = 6 * 60 * 1000

const CONFIG = {
  baseUrl: process.env.GT_BASE_URL || DEFAULT_BASE_URL,
  createPath: process.env.GT_CREATE_PATH || DEFAULT_CREATE_PATH,
  statusPath: process.env.GT_STATUS_PATH || DEFAULT_STATUS_PATH,
  downloadPath: process.env.GT_DOWNLOAD_PATH || DEFAULT_DOWNLOAD_PATH,
  imagePath: process.env.GT_IMAGE || DEFAULT_IMAGE_PATH,
  timeoutMs: Number(process.env.GT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  pollIntervalMs: Number(process.env.GT_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS),
  maxLatencyMs: Number(process.env.GT_MAX_LATENCY_MS || DEFAULT_MAX_LATENCY_MS),
  environment: process.env.GT_ENV || "staging"
}

const CASES_PATH = path.join(__dirname, 'cases.v1.json')
const OUTPUT_ROOT = path.join(__dirname, 'out')
const REPORTS_ROOT = path.join(__dirname, 'reports')

const ratioMap = {
  square: '1:1',
  portrait: '9:16',
  landscape: '16:9'
}

const outfitMap = {
  'ไม่เปลี่ยน': '',
  'ชุดวัยรุ่น': 'change outfit to modern youthful casual clothing',
  'ชุดราตรีงานเลี้ยง': 'change outfit to elegant evening gown',
  'ชุดนอน': 'change outfit to cozy sleepwear',
  'ชุดไปเที่ยว': 'change outfit to travel-friendly casual outfit',
  'ชุดไฮโซ': 'change outfit to luxury high-fashion attire',
  'ชุดไทย': 'change outfit to traditional Thai outfit'
}

const locationMap = {
  'ไม่เปลี่ยน': '',
  'ต่างจังหวัด': 'change background to a peaceful countryside in Thailand',
  'ต่างประเทศ': 'change background to an overseas travel destination',
  'คาเฟ่': 'change background to a stylish cafe',
  'ทะเล': 'change background to a sunny beach',
  'ภูเขาทะเลหมอก': 'change background to misty mountains at sunrise'
}

const activityMap = {
  'ไม่เปลี่ยน': '',
  'โพสท่าสวยๆ': 'pose with graceful fashion posture',
  'เดินท่องเที่ยว': 'walking while traveling, candid moment',
  'จิบกาแฟ': 'holding a cup of coffee',
  'แบกเป้เดินทาง': 'carrying a backpack while traveling'
}

const moodMap = {
  'ไม่เปลี่ยน': '',
  'ถ่ายแบบ': 'modeling mood, confident',
  'เศร้า': 'slightly sad mood',
  'หน้าเรียบเฉย': 'neutral calm expression',
  'ยิ้มน้อยๆ': 'gentle small smile',
  'ดีใจ': 'happy expression',
  'เหม่อมอง': 'thoughtful distant gaze'
}

function compilePrompt(intent) {
  const base = 'preserve identity and face, keep the same person, same facial features and skin tone'
  const quality = 'high quality, realistic lighting, clean details, sharp focus'

  const fragments = [
    outfitMap[intent.outfit],
    locationMap[intent.location],
    activityMap[intent.activity],
    moodMap[intent.mood]
  ].filter(Boolean)

  return [base, ...fragments, quality].join(', ')
}

function buildUrl(base, route) {
  if (!route) return base
  return new URL(route, base).toString()
}

function buildStatusUrl(jobId) {
  if (CONFIG.statusPath.includes('{id}')) {
    return buildUrl(CONFIG.baseUrl, CONFIG.statusPath.replace('{id}', jobId))
  }
  if (CONFIG.statusPath.includes(':id')) {
    return buildUrl(CONFIG.baseUrl, CONFIG.statusPath.replace(':id', jobId))
  }
  if (CONFIG.statusPath.endsWith('/')) {
    return buildUrl(CONFIG.baseUrl, `${CONFIG.statusPath}${jobId}`)
  }
  if (CONFIG.statusPath.endsWith('status')) {
    return buildUrl(CONFIG.baseUrl, `${CONFIG.statusPath}/${jobId}`)
  }
  if (CONFIG.statusPath.includes('?')) {
    return buildUrl(CONFIG.baseUrl, `${CONFIG.statusPath}&id=${encodeURIComponent(jobId)}`)
  }
  return buildUrl(CONFIG.baseUrl, `${CONFIG.statusPath}?id=${encodeURIComponent(jobId)}`)
}

function buildDownloadUrl(keyOrId) {
  if (CONFIG.downloadPath.includes('{id}')) {
    return buildUrl(CONFIG.baseUrl, CONFIG.downloadPath.replace('{id}', keyOrId))
  }
  if (CONFIG.downloadPath.includes(':id')) {
    return buildUrl(CONFIG.baseUrl, CONFIG.downloadPath.replace(':id', keyOrId))
  }
  if (CONFIG.downloadPath.endsWith('/')) {
    return buildUrl(CONFIG.baseUrl, `${CONFIG.downloadPath}${keyOrId}`)
  }
  if (CONFIG.downloadPath.includes('?')) {
    return buildUrl(CONFIG.baseUrl, `${CONFIG.downloadPath}&key=${encodeURIComponent(keyOrId)}`)
  }
  return buildUrl(CONFIG.baseUrl, `${CONFIG.downloadPath}/${encodeURIComponent(keyOrId)}`)
}

async function readJsonSafe(res) {
  const text = await res.text()
  try {
    return { data: JSON.parse(text), raw: text }
  } catch {
    return { data: null, raw: text }
  }
}

function extractJobId(data) {
  return data?.job_id || data?.jobId || data?.job?.id || data?.id || null
}

function extractStatus(data) {
  if (data?.status) return String(data.status).toLowerCase()
  if (data?.job?.status) return String(data.job.status).toLowerCase()
  return ''
}

function extractImageRef(data) {
  const url = data?.result_url || data?.image || data?.image_url || data?.output?.image_url || data?.output?.url
  if (url) return { type: 'url', value: url }

  const base64 = data?.image_base64 || data?.output?.image_base64 || data?.output?.image
  if (base64) return { type: 'base64', value: base64 }

  const key = data?.job?.result_key || data?.result_key
  if (key) return { type: 'key', value: key }

  return null
}

function ensureDataUrl(base64) {
  if (base64.startsWith('data:image')) return base64
  return `data:image/png;base64,${base64}`
}

function dataUrlToBuffer(dataUrl) {
  const [meta, base64] = dataUrl.split(',')
  const buffer = Buffer.from(base64, 'base64')
  const mime = meta.match(/data:(.*?);base64/)
  return { buffer, mime: mime ? mime[1] : 'image/png' }
}

function detectImageMime(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadCases() {
  const raw = await fs.readFile(CASES_PATH, 'utf8')
  return JSON.parse(raw)
}

async function ensureInputImage(imagePath) {
  await fs.access(imagePath)
  return fs.readFile(imagePath)
}

async function submitJob(testCase, imageBuffer) {
  const traceId = crypto.randomUUID()
  const ratio = ratioMap[testCase.ratio] || '1:1'
  const prompt = compilePrompt(testCase.intent)
  const filename = `${testCase.id}-${traceId}.png`

  const form = new FormData()
  form.append('prompt', prompt)
  form.append('ratio', ratio)
  form.append('model', 'qwen-image')
  form.append('service', 'qwen-image-edit')
  form.append('image_name', filename)
  form.append('image', new Blob([imageBuffer], { type: 'image/png' }), filename)

  const res = await fetch(buildUrl(CONFIG.baseUrl, CONFIG.createPath), {
    method: 'POST',
    headers: {
      'x-request-id': traceId
    },
    body: form
  })

  const { data, raw } = await readJsonSafe(res)
  if (!data) {
    throw new Error(`Create endpoint returned non-JSON: ${res.status} ${raw.slice(0, 200)}`)
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Create request failed: ${res.status}`)
  }

  const jobId = extractJobId(data)
  if (!jobId) {
    throw new Error('Create response missing job id')
  }

  return { traceId, jobId }
}

async function pollJob(jobId, startTime) {
  const deadline = startTime + CONFIG.timeoutMs

  while (Date.now() < deadline) {
    const res = await fetch(buildStatusUrl(jobId), { method: 'GET' })
    const { data, raw } = await readJsonSafe(res)
    if (!data) {
      throw new Error(`Status endpoint returned non-JSON: ${res.status} ${raw.slice(0, 200)}`)
    }

    if (!res.ok || data.ok === false) {
      if (data?.job?.status === 'failed') {
        return { status: 'failed', data }
      }
    }

    const status = extractStatus(data)
    if (status === 'completed' || status === 'success' || status === 'done') {
      return { status: 'completed', data }
    }
    if (status === 'failed' || status === 'error') {
      return { status: 'failed', data }
    }

    await delay(CONFIG.pollIntervalMs)
  }

  return { status: 'timeout', data: null }
}

async function downloadImage(imageRef, outputPath) {
  if (imageRef.type === 'base64') {
    const dataUrl = ensureDataUrl(imageRef.value)
    const { buffer, mime } = dataUrlToBuffer(dataUrl)
    await fs.writeFile(outputPath, buffer)
    return { mime, size: buffer.length }
  }

  if (imageRef.type === 'key') {
    const url = buildDownloadUrl(imageRef.value)
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status}`)
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    await fs.writeFile(outputPath, buffer)
    const mime = res.headers.get('content-type') || detectImageMime(buffer)
    return { mime, size: buffer.length }
  }

  if (imageRef.type === 'url') {
    const res = await fetch(imageRef.value)
    if (!res.ok) {
      throw new Error(`Download failed: ${res.status}`)
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    await fs.writeFile(outputPath, buffer)
    const mime = res.headers.get('content-type') || detectImageMime(buffer)
    return { mime, size: buffer.length }
  }

  throw new Error('Unknown image ref type')
}

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`
}

function renderReportMd(report) {
  const lines = []
  lines.push('# Golden Prompt Test Report')
  lines.push('')
  lines.push(`- Run ID: ${report.runId}`)
  lines.push(`- Workflow: ${report.workflow}`)
  lines.push(`- Version: ${report.version}`)
  lines.push(`- Started: ${report.startedAt}`)
  lines.push(`- Finished: ${report.finishedAt}`)
  lines.push(`- Base URL: ${report.baseUrl}`)
  lines.push('')
  lines.push('| Case ID | Name | Status | Duration | Output | Error |')
  lines.push('| --- | --- | --- | --- | --- | --- |')

  for (const item of report.results) {
    lines.push(`| ${item.id} | ${item.name} | ${item.status} | ${formatDuration(item.durationMs || 0)} | ${item.outputPath || '-'} | ${item.error || '-'} |`)
  }

  lines.push('')
  return lines.join('\n')
}

function renderSummaryTable(report) {
  const lines = []
  lines.push('Case ID | Status | Duration | Notes')
  lines.push('--- | --- | --- | ---')
  for (const item of report.results) {
    const note = item.error ? item.error : 'ok'
    lines.push(`${item.id} | ${item.status} | ${formatDuration(item.durationMs || 0)} | ${note}`)
  }
  return lines.join('\n')
}

async function main() {
  const casesData = await loadCases()
  const imageBuffer = await ensureInputImage(CONFIG.imagePath)

  const runId = `run-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const runDir = path.join(OUTPUT_ROOT, runId)
  await fs.mkdir(runDir, { recursive: true })
  await fs.mkdir(REPORTS_ROOT, { recursive: true })

  const report = {
    runId,
    workflow: casesData.workflow,
    version: casesData.version,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    environment: CONFIG.environment,
    baseUrl: CONFIG.baseUrl,
    createPath: CONFIG.createPath,
    statusPath: CONFIG.statusPath,
    downloadPath: CONFIG.downloadPath,
    maxLatencyMs: CONFIG.maxLatencyMs,
    results: []
  }

  for (const testCase of casesData.cases) {
    const caseStart = Date.now()
    const caseDir = path.join(runDir, testCase.id)
    await fs.mkdir(caseDir, { recursive: true })

    console.log(`[GT] ${testCase.id} - เริ่มส่งงาน`)

    let traceId = null
    let jobId = null
    let status = 'error'
    let errorMessage = null
    let outputPath = null
    let mime = null
    let outputSizeBytes = null

    try {
      const submitResult = await submitJob(testCase, imageBuffer)
      traceId = submitResult.traceId
      jobId = submitResult.jobId

      console.log(`[GT] ${testCase.id} - jobId: ${jobId}`)

      const pollResult = await pollJob(jobId, caseStart)
      status = pollResult.status

      if (status === 'completed') {
        const imageRef = extractImageRef(pollResult.data)
        if (!imageRef) {
          throw new Error('Contract mismatch: COMPLETED but no image reference returned')
        }
        outputPath = path.join(caseDir, 'final.png')
        const downloadResult = await downloadImage(imageRef, outputPath)
        mime = downloadResult.mime
        outputSizeBytes = downloadResult.size

        if (!mime || (!mime.includes('png') && !mime.includes('jpeg'))) {
          throw new Error(`Unexpected image mime: ${mime || 'unknown'}`)
        }
        console.log(`[GT] ${testCase.id} - ดาวน์โหลดผลลัพธ์เรียบร้อย`)
      } else if (status === 'failed') {
        errorMessage = pollResult.data?.error || pollResult.data?.job?.error || 'Job failed'
      } else if (status === 'timeout') {
        errorMessage = 'Timeout waiting for completion'
      }
    } catch (error) {
      status = 'error'
      errorMessage = error.message || String(error)
    }

    const durationMs = Date.now() - caseStart
    if (status === 'completed' && durationMs > CONFIG.maxLatencyMs) {
      status = 'failed'
      errorMessage = `Latency exceeded ${formatDuration(CONFIG.maxLatencyMs)}`
    }

    report.results.push({
      id: testCase.id,
      name: testCase.name,
      traceId,
      jobId,
      status,
      durationMs,
      outputPath,
      outputSizeBytes,
      mime,
      error: errorMessage
    })

    console.log(`[GT] ${testCase.id} - สถานะ: ${status}`)
  }

  report.finishedAt = new Date().toISOString()

  const reportJsonPath = path.join(runDir, 'report.json')
  const reportMdPath = path.join(runDir, 'report.md')
  const latestJsonPath = path.join(REPORTS_ROOT, 'latest.json')

  await fs.writeFile(reportJsonPath, JSON.stringify(report, null, 2), 'utf8')
  await fs.writeFile(reportMdPath, renderReportMd(report), 'utf8')
  await fs.writeFile(latestJsonPath, JSON.stringify(report, null, 2), 'utf8')

  console.log(renderSummaryTable(report))
  console.log(`[GT] บันทึกรายงานที่ ${reportJsonPath}`)

  const failedCount = report.results.filter((item) => item.status !== 'completed').length
  if (failedCount > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[GT] Error:', error.message || error)
  process.exit(1)
})
