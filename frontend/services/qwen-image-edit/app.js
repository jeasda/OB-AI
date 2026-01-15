import { createOptionSelect } from './components/OptionSelect.js'
import { createRatioSelect } from './components/RatioSelect.js'
import { createPaymentModal } from './components/PaymentModal.js'
import { createProgressPanel } from './components/ProgressPanel.js'
import { createResultPanel } from './components/ResultPanel.js'
import { buildPromptV1, catalogs } from './lib/promptEngineV1.js'
import { getCredits, addCredits, spendCredits } from './lib/creditsStore.js'
import { States, Events, transition, deriveFlags, createInitialContext } from './lib/stateMachine.js'

const STORAGE_KEYS = {
  options: 'obai_qwen_image_edit_options',
  history: 'obai_qwen_image_edit_history'
}

const COST_PER_IMAGE = 1
const POLL_INTERVAL_MS = 4000
const TIMEOUT_MS = 12 * 60 * 1000

const defaultOptions = {
  clothes: 'ไม่เปลี่ยน',
  location: 'ไม่เปลี่ยน',
  locationSub: '',
  activity: 'ไม่ระบุ',
  activitySub: '',
  mood: 'ถ่ายแบบ',
  ratio: 'square',
  ratioDisplay: 'Square'
}

const elements = {
  uploadZone: document.getElementById('upload-zone'),
  fileInput: document.getElementById('file-input'),
  previewThumb: document.getElementById('preview-thumb'),
  beforePanel: document.getElementById('before-after'),
  beforeImage: document.getElementById('before-image'),
  optionsSlot: document.getElementById('options-slot'),
  ratioSlot: document.getElementById('ratio-slot'),
  promptInput: document.getElementById('prompt-input'),
  submitBtn: document.getElementById('submit-btn'),
  inlineError: document.getElementById('inline-error'),
  marketingPanel: document.getElementById('marketing-panel'),
  progressSlot: document.getElementById('progress-slot'),
  resultSlot: document.getElementById('result-slot'),
  errorPanel: document.getElementById('error-panel'),
  errorText: document.getElementById('error-text'),
  retryBtn: document.getElementById('retry-btn'),
  downloadBtn: document.getElementById('download-btn'),
  generateNewBtn: document.getElementById('generate-new-btn'),
  statePill: document.getElementById('state-pill'),
  creditPill: document.getElementById('credit-pill'),
  creditRail: document.getElementById('credit-rail'),
  promptPreviewText: document.getElementById('prompt-preview-text'),
  promptPreviewTags: document.getElementById('prompt-preview-tags')
}

let machine = {
  state: States.idle,
  context: createInitialContext(defaultOptions)
}

let pollTimer = null
let pollController = null
let currentResultUrl = ''
let pendingSubmit = false
let jobStartAt = 0
let isDrawing = false
let hasMask = false
let lastPoint = null

const savedOptions = loadOptions()
machine.context.options = { ...defaultOptions, ...savedOptions }

const optionControls = {}

const clothesControl = createOptionSelect({
  id: 'opt-clothes',
  label: 'เปลี่ยนชุดเสื้อผ้า',
  options: catalogs.clothes.map((item) => ({ value: item.label, label: item.label })),
  value: machine.context.options.clothes,
  onChange: (value) => updateOption('clothes', value)
})
optionControls.clothes = clothesControl

elements.optionsSlot.appendChild(clothesControl.el)

const locationControl = createOptionSelect({
  id: 'opt-location',
  label: 'เปลี่ยนสถานที่',
  options: catalogs.location.map((item) => ({ value: item.label, label: item.label })),
  value: machine.context.options.location,
  onChange: (value) => updateOption('location', value)
})
optionControls.location = locationControl

elements.optionsSlot.appendChild(locationControl.el)

const locationSubControl = createOptionSelect({
  id: 'opt-location-sub',
  label: 'สถานที่/เมือง',
  options: [{ value: '', label: 'ไม่ระบุ' }],
  value: machine.context.options.locationSub,
  onChange: (value) => updateOption('locationSub', value)
})
optionControls.locationSub = locationSubControl

elements.optionsSlot.appendChild(locationSubControl.el)

const activityControl = createOptionSelect({
  id: 'opt-activity',
  label: 'กำลังทำอะไร',
  options: catalogs.activity.map((item) => ({ value: item.label, label: item.label })),
  value: machine.context.options.activity,
  onChange: (value) => updateOption('activity', value)
})
optionControls.activity = activityControl

elements.optionsSlot.appendChild(activityControl.el)

const activitySubControl = createOptionSelect({
  id: 'opt-activity-sub',
  label: 'รายละเอียดกิจกรรม',
  options: [{ value: '', label: 'ไม่ระบุ' }],
  value: machine.context.options.activitySub,
  onChange: (value) => updateOption('activitySub', value)
})
optionControls.activitySub = activitySubControl

elements.optionsSlot.appendChild(activitySubControl.el)

const moodControl = createOptionSelect({
  id: 'opt-mood',
  label: 'อารมณ์ไหน',
  options: catalogs.mood.map((item) => ({ value: item.label, label: item.label })),
  value: machine.context.options.mood,
  onChange: (value) => updateOption('mood', value)
})
optionControls.mood = moodControl

elements.optionsSlot.appendChild(moodControl.el)

const ratioControl = createRatioSelect({
  value: machine.context.options.ratio,
  onChange: (value) => {
    const ratioLabel = catalogs.ratio.find((ratio) => ratio.id === value)?.label || 'Square'
    updateOption('ratio', value)
    updateOption('ratioDisplay', ratioLabel)
    ratioControl.setValue(value)
  }
})

elements.ratioSlot.appendChild(ratioControl.el)

updateSubSelects()
updatePromptPreview()
render()

const progressPanel = createProgressPanel()
elements.progressSlot.appendChild(progressPanel.el)

const resultPanel = createResultPanel({
  onDownload: downloadResult,
  onGenerateNew: handleGenerateAgain
})
elements.resultSlot.appendChild(resultPanel.el)

const paymentModal = createPaymentModal({
  onClose: () => {
    paymentModal.close()
    dispatch({ type: Events.cancelPay })
  },
  onPurchasePackage: (credits) => {
    addCredits(credits)
    updateCreditsUI()
    paymentModal.close()
    if (pendingSubmit) {
      pendingSubmit = false
      handleSubmit()
    }
  },
  onPaySingle: () => {
    addCredits(COST_PER_IMAGE)
    updateCreditsUI()
    paymentModal.close()
    if (pendingSubmit) {
      pendingSubmit = false
      handleSubmit()
    }
  }
})

document.getElementById('payment-modal-root').appendChild(paymentModal.el)

// Upload handlers

elements.uploadZone.addEventListener('click', () => elements.fileInput.click())
elements.uploadZone.addEventListener('dragover', (event) => {
  event.preventDefault()
  elements.uploadZone.classList.add('is-dragging')
})
elements.uploadZone.addEventListener('dragleave', () => {
  elements.uploadZone.classList.remove('is-dragging')
})
elements.uploadZone.addEventListener('drop', (event) => {
  event.preventDefault()
  elements.uploadZone.classList.remove('is-dragging')
  const file = event.dataTransfer.files[0]
  if (file) handleFile(file)
})

elements.fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0]
  if (file) handleFile(file)
})

// Actions

elements.submitBtn.addEventListener('click', handleSubmit)

elements.generateNewBtn.addEventListener('click', handleGenerateAgain)

elements.downloadBtn.addEventListener('click', downloadResult)

elements.retryBtn.addEventListener('click', () => dispatch({ type: Events.retry }))

elements.promptInput.addEventListener('input', () => {
  machine.context.promptText = elements.promptInput.value.trim()
})

function updateOption(key, value) {
  dispatch({ type: Events.setOption, key, value })
  if (key === 'location') {
    updateOption('locationSub', '')
  }
  if (key === 'activity') {
    updateOption('activitySub', '')
  }
  updateSubSelects()
  persistOptions()
  updatePromptPreview()
}

function updateSubSelects() {
  const location = machine.context.options.location
  const locationEntry = catalogs.location.find((item) => item.label === location)
  const subLocations = locationEntry?.sub || []
  locationSubControl.el.classList.toggle('hidden', subLocations.length === 0)
  replaceOptions(locationSubControl, subLocations)

  const activity = machine.context.options.activity
  const activityEntry = catalogs.activity.find((item) => item.label === activity)
  const subActivities = activityEntry?.sub || []
  activitySubControl.el.classList.toggle('hidden', subActivities.length === 0)
  replaceOptions(activitySubControl, subActivities)
}

function replaceOptions(control, options) {
  const select = control.el.querySelector('select')
  select.innerHTML = ''
  const defaultOpt = document.createElement('option')
  defaultOpt.value = ''
  defaultOpt.textContent = 'ไม่ระบุ'
  select.appendChild(defaultOpt)
  for (const option of options) {
    const opt = document.createElement('option')
    opt.value = option
    opt.textContent = option
    select.appendChild(opt)
  }
  select.value = machine.context.options[select.id === 'opt-location-sub' ? 'locationSub' : 'activitySub'] || ''
}

function dispatch(event) {
  const prevState = machine.state
  const prevContext = machine.context
  machine = transition(machine.state, machine.context, event)
  render()
  handleStateChange(prevState, prevContext, machine.state, machine.context, event)
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    showInlineError('กรุณาอัปโหลดไฟล์ภาพเท่านั้น')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    showInlineError('ไฟล์ต้องมีขนาดไม่เกิน 10MB')
    return
  }

  machine.context.options = { ...machine.context.options }
  dispatch({ type: Events.uploadImage, file })

  elements.previewThumb.src = URL.createObjectURL(file)
  elements.previewThumb.classList.remove('hidden')
  elements.beforeImage.src = elements.previewThumb.src
  elements.beforePanel.classList.remove('hidden')
  setupMaskCanvas()
  showInlineError('')
  updateOption('ratio', machine.context.options.ratio)
}

function handleSubmit() {
  showInlineError('')
  elements.errorPanel.classList.add('hidden')

  if (!machine.context.imageFile) {
    showInlineError('กรุณาอัปโหลดภาพก่อนเริ่มแก้ไข')
    return
  }

  if (!machine.context.hasMask) {
    showInlineError('กรุณาระบายบริเวณที่ต้องการแก้ไขก่อน')
    showError('กรุณาระบายบริเวณที่ต้องการแก้ไขก่อน')
    return
  }

  const credits = getCredits()
  if (credits < COST_PER_IMAGE) {
    pendingSubmit = true
    dispatch({ type: Events.openPayment })
    paymentModal.open({ creditsNeeded: COST_PER_IMAGE, balance: credits })
    return
  }

  if (!spendCredits(COST_PER_IMAGE)) {
    showInlineError('เครดิตไม่เพียงพอ')
    return
  }

  updateCreditsUI()
  dispatch({ type: Events.submit })
}

async function submitJob() {
  progressPanel.setProgress(0)
  progressPanel.setTitle('กำลังส่งงาน')
  progressPanel.setNote('กำลังส่งภาพไปยังระบบประมวลผล')
  progressPanel.setStep(0)

  const promptPayload = buildPromptV1(machine.context.options, 'th')
  const userPrompt = machine.context.promptText ? ` ${machine.context.promptText}` : ''
  const formData = new FormData()
  formData.append('prompt', `${promptPayload.prompt}${userPrompt}`)
  formData.append('ratio', machine.context.options.ratio)
  formData.append('model', 'qwen-image')
  formData.append('service', 'qwen-image-edit')
  formData.append('image', machine.context.imageFile)
  formData.append('options', JSON.stringify(machine.context.options))

  try {
    const res = await fetch('/api/queue/create', {
      method: 'POST',
      body: formData
    })

    const data = await res.json()
    if (!res.ok || !data.ok) {
      throw new Error('เริ่มงานไม่สำเร็จ กรุณาลองใหม่')
    }

    const jobId = data.job_id || data.jobId || data.job?.id
    if (!jobId) throw new Error('ไม่พบรหัสงาน')

    jobStartAt = Date.now()
    dispatch({ type: Events.jobAccepted, jobId })
  } catch {
    dispatch({ type: Events.jobFailed, error: 'เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่' })
  }
}

function startPolling() {
  stopPolling()
  pollController = new AbortController()
  pollTimer = setInterval(checkStatus, POLL_INTERVAL_MS)
  checkStatus()
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  if (pollController) {
    pollController.abort()
    pollController = null
  }
}

async function checkStatus() {
  if (!machine.context.jobId) return
  if (Date.now() - jobStartAt > TIMEOUT_MS) {
    dispatch({ type: Events.timeout })
    return
  }

  try {
    const res = await fetch(`/api/queue/status/${machine.context.jobId}`, {
      signal: pollController?.signal
    })
    const data = await res.json()

    if (!res.ok || !data.ok) {
      if (data?.job?.status === 'failed') {
        throw new Error('งานล้มเหลว กรุณาลองใหม่อีกครั้ง')
      }
      updateProgressByStatus('queued')
      return
    }

    const status = data?.job?.status
    if (status === 'completed') {
      const resultUrl = data.result_url || (data.job?.result_key ? `/api/result/${encodeURIComponent(data.job.result_key)}` : '')
      if (!resultUrl) throw new Error('ไม่พบผลลัพธ์')
      dispatch({ type: Events.jobCompleted, resultUrl })
    } else if (status === 'failed') {
      throw new Error('งานล้มเหลว กรุณาลองใหม่อีกครั้ง')
    } else {
      updateProgressByStatus(status)
    }
  } catch (error) {
    dispatch({ type: Events.jobFailed, error: error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่' })
  }
}

function updateProgressByStatus(status) {
  if (status === 'queued') {
    progressPanel.setTitle('รอคิว GPU')
    progressPanel.setNote('กำลังรอคิวประมวลผลบน GPU')
    progressPanel.setProgress(20)
    progressPanel.setStep(0)
    return
  }
  if (status === 'running') {
    progressPanel.setTitle('กำลังประมวลผล')
    progressPanel.setNote('ระบบกำลังสร้างภาพให้คุณ')
    progressPanel.setProgress(60)
    progressPanel.setStep(1)
    return
  }
  progressPanel.setTitle('เก็บรายละเอียด')
  progressPanel.setNote('กำลังปรับรายละเอียดขั้นสุดท้าย')
  progressPanel.setProgress(85)
  progressPanel.setStep(2)
}

function handleGenerateAgain() {
  currentResultUrl = ''
  dispatch({ type: Events.generateAgain })
}

function showError(message) {
  elements.errorText.textContent = message
  elements.errorPanel.classList.remove('hidden')
}

function render() {
  const flags = deriveFlags(machine.state, machine.context)

  elements.submitBtn.disabled = !flags.canSubmit
  elements.marketingPanel.classList.toggle('hidden', flags.showProgress || flags.showResult)
  const maskHint = document.getElementById('mask-hint')
  if (maskHint) {
    const showHint = !!machine.context.imageFile && !machine.context.hasMask
    maskHint.classList.toggle('hidden', !showHint)
  }

  if (!flags.showProgress) {
    progressPanel.hide()
  }
  if (!flags.showResult) {
    resultPanel.hide()
  }

  updateActionButtons(flags.showResult)
  setControlsDisabled(flags.isBusy || flags.showPayment)
  updateStatePill(machine.state)

  if (flags.showError) {
    showError(machine.context.error || 'เกิดข้อผิดพลาด')
  } else {
    elements.errorText.textContent = ''
    elements.errorPanel.classList.add('hidden')
  }
}

function handleStateChange(prevState, prevContext, nextState, nextContext) {
  if (nextState === States.generating && prevState !== States.generating) {
    progressPanel.show()
    submitJob()
  }

  if (nextState === States.generating && prevState !== States.generating) {
    startPolling()
  }

  if (prevState === States.generating && nextState !== States.generating) {
    stopPolling()
  }

  if (nextState === States.completed) {
    progressPanel.setProgress(100)
    progressPanel.setTitle('เสร็จแล้ว')
    progressPanel.setStep(2)

    currentResultUrl = nextContext.resultUrl
    resultPanel.setImage(nextContext.resultUrl)
    resultPanel.show()
    saveHistory(nextContext.resultUrl)
    elements.errorText.textContent = ''
  }

  if (nextState === States.error) {
    stopPolling()
  }
}

function updateActionButtons(enabled) {
  elements.downloadBtn.disabled = !enabled
  elements.generateNewBtn.disabled = !enabled
}

function setControlsDisabled(disabled) {
  const hasImage = !!machine.context.imageFile
  elements.fileInput.disabled = disabled
  elements.uploadZone.classList.toggle('is-disabled', disabled)
  elements.submitBtn.disabled = disabled || !hasImage || !deriveFlags(machine.state, machine.context).canSubmit
  elements.promptInput.disabled = disabled || !machine.context.hasMask

  const selects = elements.optionsSlot.querySelectorAll('select')
  selects.forEach((select) => {
    select.disabled = disabled || !hasImage
  })

  const ratioButtons = elements.ratioSlot.querySelectorAll('button')
  ratioButtons.forEach((btn) => {
    btn.disabled = disabled || !hasImage
  })
}

function showInlineError(message) {
  elements.inlineError.textContent = message
}

function updateCreditsUI() {
  const credits = getCredits()
  elements.creditPill.textContent = `เครดิตคงเหลือ ${credits}`
  elements.creditRail.textContent = `เครดิตคงเหลือ ${credits}`
}

function updatePromptPreview() {
  const result = buildPromptV1(machine.context.options, 'th')
  elements.promptPreviewText.textContent = result.prompt
  elements.promptPreviewTags.textContent = result.tags.length ? `แท็ก: ${result.tags.join(', ')}` : ''
}

function updateStatePill(state) {
  const labels = {
    [States.idle]: 'พร้อมเริ่ม',
    [States.imageUploaded]: 'อัปโหลดแล้ว',
    [States.readyToGenerate]: 'พร้อมสร้างภาพ',
    [States.paymentRequired]: 'รอชำระเงิน',
    [States.generating]: 'กำลังประมวลผล',
    [States.completed]: 'เสร็จแล้ว',
    [States.error]: 'เกิดข้อผิดพลาด',
    [States.downloading]: 'กำลังดาวน์โหลด'
  }
  elements.statePill.textContent = labels[state] || 'สถานะไม่ทราบ'
}

function setupMaskCanvas() {
  const canvas = document.getElementById('mask-canvas')
  const img = elements.beforeImage
  if (!canvas || !img) return

  const resize = () => {
    canvas.width = img.clientWidth
    canvas.height = img.clientHeight
  }

  img.onload = () => {
    resize()
    clearMask()
  }

  resize()
  clearMask()

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.lineWidth = 24
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)'

  const startDraw = (event) => {
    isDrawing = true
    lastPoint = getPoint(event)
  }

  const draw = (event) => {
    if (!isDrawing || !ctx) return
    const point = getPoint(event)
    ctx.beginPath()
    ctx.moveTo(lastPoint.x, lastPoint.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPoint = point
    if (!hasMask) {
      hasMask = true
      dispatch({ type: Events.maskDrawn })
    }
  }

  const endDraw = () => {
    isDrawing = false
    lastPoint = null
  }

  canvas.onmousedown = startDraw
  canvas.onmousemove = draw
  canvas.onmouseup = endDraw
  canvas.onmouseleave = endDraw

  canvas.ontouchstart = (event) => startDraw(event.touches[0])
  canvas.ontouchmove = (event) => {
    event.preventDefault()
    draw(event.touches[0])
  }
  canvas.ontouchend = endDraw
}

function getPoint(event) {
  const rect = document.getElementById('mask-canvas').getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

function clearMask() {
  const canvas = document.getElementById('mask-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  hasMask = false
  dispatch({ type: Events.maskCleared })
}

function persistOptions() {
  localStorage.setItem(STORAGE_KEYS.options, JSON.stringify(machine.context.options))
}

function loadOptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.options)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveHistory(resultUrl) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.history)
    const history = raw ? JSON.parse(raw) : []
    const entry = { url: resultUrl, createdAt: new Date().toISOString() }
    const next = [entry, ...history].slice(0, 5)
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(next))
  } catch {
    return
  }
}

async function downloadResult() {
  if (!currentResultUrl) return
  dispatch({ type: Events.downloadStart })
  try {
    let sourceBlob
    if (currentResultUrl.startsWith('data:image')) {
      sourceBlob = dataUrlToBlob(currentResultUrl)
    } else {
      const res = await fetch(currentResultUrl)
      sourceBlob = await res.blob()
    }

    triggerDownload(sourceBlob, 'qwen-image-edit.png')
  } catch {
    showInlineError('ดาวน์โหลดไม่สำเร็จ กรุณาลองใหม่')
  } finally {
    dispatch({ type: Events.downloadDone })
  }
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',')
  const mimeMatch = meta.match(/data:(.*?);base64/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

updateCreditsUI()
