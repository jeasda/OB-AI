const goodPayload = {
  service: 'qwen-image-edit',
  workflow_version: 'v1.0.0',
  prompt: 'ปรับภาพนี้ให้สมจริง คมชัด โทนสวย เป็นธรรมชาติ',
  ratio: '9:16',
  options: {
    clothes: 'ชุดไทย',
    location: 'คาเฟ่',
    activity: 'จิบกาแฟ',
    mood: 'ยิ้มน้อยๆ',
    ratioDisplay: 'ภาพถ่ายแนวตั้ง'
  },
  image: { base64: 'data:image/png;base64,AAA' },
  clientRequestId: 'req-123'
}

const badPayloads = [
  { ...goodPayload, prompt: '' },
  { ...goodPayload, ratio: '2:3' },
  { ...goodPayload, service: 'unknown-service' },
  { ...goodPayload, image: null }
]

function validate(payload) {
  const errors = []
  if (payload.service !== 'qwen-image-edit') return { ok: true, errors: [] }
  if (!payload.prompt || payload.prompt.trim().length === 0) errors.push('prompt_required')
  if (!['1:1', '16:9', '9:16'].includes(payload.ratio)) errors.push('ratio_invalid')
  if (!payload.image || (!payload.image.base64 && !payload.image.url)) errors.push('image_required')
  return { ok: errors.length === 0, errors }
}

function run() {
  const good = validate(goodPayload)
  if (!good.ok) {
    console.error('[Contract] Good payload failed:', good.errors)
    process.exit(1)
  }

  let failed = 0
  for (const bad of badPayloads) {
    const res = validate(bad)
    if (res.ok) {
      failed += 1
      console.error('[Contract] Bad payload passed:', bad)
    }
  }

  if (failed > 0) process.exit(1)
  console.log('[Contract] Validation passed')
}

run()
