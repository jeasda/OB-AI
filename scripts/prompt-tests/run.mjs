import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const casesPath = path.join(__dirname, 'cases.v1.json')
const reportDir = path.join(__dirname, 'reports')
const reportPath = path.join(reportDir, 'latest.json')

const promptEnginePath = pathToFileURL(
  path.join(__dirname, '..', '..', 'frontend', 'services', 'qwen-image-edit', 'lib', 'promptEngineV1.js')
).href

const { buildPromptV1 } = await import(promptEnginePath)

const raw = fs.readFileSync(casesPath, 'utf8')
const payload = JSON.parse(raw)

const results = []
let passed = 0
let failed = 0

for (const testCase of payload.cases || []) {
  const { id, name, selection, expect } = testCase
  const errors = []

  const first = buildPromptV1(selection, 'th')
  const second = buildPromptV1(selection, 'th')

  if (first.prompt !== second.prompt) {
    errors.push('prompt_not_deterministic')
  }

  for (const token of expect?.contains || []) {
    if (!first.prompt.includes(token)) {
      errors.push(`missing:${token}`)
    }
  }

  for (const token of expect?.notContains || []) {
    if (first.prompt.includes(token)) {
      errors.push(`banned:${token}`)
    }
  }

  const ok = errors.length === 0
  if (ok) {
    passed += 1
  } else {
    failed += 1
  }

  results.push({
    id,
    name,
    ok,
    errors,
    prompt: first.prompt,
    tags: first.tags,
    ratio: first.ratio
  })

  const statusLabel = ok ? 'PASS' : 'FAIL'
  console.log(`[${statusLabel}] ${id} - ${name}`)
}

const summary = {
  total: results.length,
  passed,
  failed,
  version: payload.version || 'v1'
}

fs.mkdirSync(reportDir, { recursive: true })
fs.writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2), 'utf8')

console.log(`\nTotal: ${summary.total}  Passed: ${summary.passed}  Failed: ${summary.failed}`)
console.log(`Report: ${reportPath}`)

if (failed > 0) {
  process.exitCode = 1
}
