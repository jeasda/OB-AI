const States = {
  showroom: 'showroom',
  processing: 'processing',
  result: 'result'
}

const elements = {
  body: document.body,
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  uploadZone: document.getElementById('upload-zone'),
  fileInput: document.getElementById('file-input'),
  uploadPreview: document.getElementById('upload-preview'),
  uploadMeta: document.getElementById('upload-meta'),
  uploadName: document.getElementById('upload-name'),
  uploadSize: document.getElementById('upload-size'),
  promptInput: document.getElementById('prompt-input'),
  presetChips: document.getElementById('preset-chips'),
  ratioSelect: document.getElementById('ratio-select'),
  detailStrength: document.getElementById('detail-strength'),
  detailValue: document.getElementById('detail-value'),
  preserveLighting: document.getElementById('preserve-lighting'),
  generateBtn: document.getElementById('generate-btn'),
  inlineError: document.getElementById('inline-error'),
  progressBar: document.getElementById('progress-bar'),
  progressPercent: document.getElementById('progress-percent'),
  statusText: document.getElementById('status-text'),
  resultImage: document.getElementById('result-image'),
  downloadBtn: document.getElementById('download-btn'),
  regenBtn: document.getElementById('regen-btn'),
  zoomBtn: document.getElementById('zoom-btn'),
  lightbox: document.getElementById('lightbox'),
  lightboxImage: document.getElementById('lightbox-image'),
  lightboxClose: document.getElementById('lightbox-close'),
  showroom: document.getElementById('state-showroom'),
  processing: document.getElementById('state-processing'),
  result: document.getElementById('state-result')
}

const STATUS_STEPS = [
  { text: 'Uploading image', target: 28 },
  { text: 'Processing prompt', target: 62 },
  { text: 'Generating result', target: 88 },
  { text: 'Finalizing output', target: 98 }
]

let currentState = States.showroom
let selectedFile = null
let previewUrl = ''
let jobId = null
let progressTimer = null
let pollTimer = null
let progressValue = 0
let statusIndex = 0

const API_CREATE = '/api/queue/create'
const API_STATUS = '/api/queue/status'

function setState(nextState) {
  currentState = nextState
  elements.showroom.classList.toggle('is-active', nextState === States.showroom)
  elements.processing.classList.toggle('is-active', nextState === States.processing)
  elements.result.classList.toggle('is-active', nextState === States.result)

  const isBusy = nextState === States.processing
  elements.body.classList.toggle('is-busy', isBusy)
  elements.body.setAttribute('aria-busy', String(isBusy))
  setControlsDisabled(isBusy)
}

function setControlsDisabled(disabled) {
  const buttons = elements.presetChips.querySelectorAll('button')
  buttons.forEach((button) => {
    button.disabled = disabled
  })

  elements.fileInput.disabled = disabled
  elements.promptInput.disabled = disabled
  elements.ratioSelect.disabled = disabled
  elements.detailStrength.disabled = disabled
  elements.preserveLighting.disabled = disabled
  elements.generateBtn.disabled = disabled || !isFormReady()
}

function isFormReady() {
  return !!selectedFile && elements.promptInput.value.trim().length > 0
}

function setInlineError(message) {
  elements.inlineError.textContent = message
}

function setProgress(value) {
  const clamped = Math.max(0, Math.min(100, value))
  elements.progressBar.style.width = `${clamped}%`
  elements.progressPercent.textContent = `${Math.round(clamped)}%`
}

function setStatus(text) {
  elements.statusText.textContent = text
}

function startProgress() {
  stopProgress()
  progressValue = 0
  statusIndex = 0
  setProgress(0)
  setStatus(STATUS_STEPS[0].text)

  progressTimer = setInterval(() => {
    const step = STATUS_STEPS[statusIndex]
    const increment = step.target >= 90 ? 0.3 : 0.8
    progressValue = Math.min(step.target, progressValue + increment)
    setProgress(progressValue)

    if (progressValue >= step.target && statusIndex < STATUS_STEPS.length - 1) {
      statusIndex += 1
      setStatus(STATUS_STEPS[statusIndex].text)
    }
  }, 180)
}

function stopProgress() {
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = null
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(checkStatus, 4000)
  checkStatus()
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function handleUploadClick() {
  elements.fileInput.click()
}

function handleUploadKey(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    elements.fileInput.click()
  }
}

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    setInlineError('Please upload a PNG or JPG image.')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    setInlineError('File size must be under 10MB.')
    return
  }

  selectedFile = file
  if (previewUrl) URL.revokeObjectURL(previewUrl)
  previewUrl = URL.createObjectURL(file)
  elements.uploadPreview.src = previewUrl
  elements.uploadPreview.classList.remove('hidden')
  elements.uploadZone.classList.add('has-preview')
  elements.uploadMeta.classList.remove('hidden')
  elements.uploadName.textContent = file.name
  elements.uploadSize.textContent = `${(file.size / 1024 / 1024).toFixed(1)}MB`
  setInlineError('')
  updateGenerateState()
}

function updateGenerateState() {
  elements.generateBtn.disabled = !isFormReady()
}

function handlePresetClick(event) {
  const button = event.target.closest('button')
  if (!button) return
  const preset = button.dataset.prompt
  if (!preset) return

  const current = elements.promptInput.value.trim()
  elements.promptInput.value = current ? `${current}, ${preset}` : preset
  elements.promptInput.focus()

  elements.presetChips.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('is-active', chip === button)
  })

  updateGenerateState()
}

function handleDetailChange() {
  elements.detailValue.textContent = elements.detailStrength.value
}

async function handleGenerate() {
  if (!isFormReady()) {
    setInlineError('Add an image and a prompt to continue.')
    return
  }

  setInlineError('')
  setState(States.processing)
  startProgress()

  try {
    const formData = new FormData()
    formData.append('prompt', elements.promptInput.value.trim())
    formData.append('ratio', elements.ratioSelect.value)
    formData.append('model', 'qwen-image')
    formData.append('service', 'qwen-image-edit')
    formData.append('image', selectedFile)
    formData.append(
      'options',
      JSON.stringify({
        detailStrength: Number(elements.detailStrength.value),
        preserveLighting: elements.preserveLighting.checked
      })
    )

    const response = await fetch(API_CREATE, {
      method: 'POST',
      body: formData
    })

    const data = await response.json()
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Failed to start generation.')
    }

    jobId = data.job_id || data.jobId || data.job?.id
    if (!jobId) throw new Error('Job ID missing from response.')

    startPolling()
  } catch (error) {
    handleFailure(error.message || 'Generation failed.')
  }
}

async function checkStatus() {
  if (!jobId) return

  try {
    const response = await fetch(`${API_STATUS}/${jobId}`)
    const data = await response.json()

    if (!response.ok || !data.ok) {
      if (data?.job?.status === 'failed') {
        throw new Error('Generation failed on the server.')
      }
      return
    }

    const status = data?.job?.status
    if (status === 'completed') {
      const resultUrl = data.result_url || (data.job?.result_key ? `/api/result/${encodeURIComponent(data.job.result_key)}` : '')
      if (!resultUrl) throw new Error('Missing result URL.')
      showResult(resultUrl)
      return
    }

    if (status === 'failed') {
      throw new Error('Generation failed on the server.')
    }
  } catch (error) {
    handleFailure(error.message || 'Generation failed.')
  }
}

function showResult(url) {
  stopPolling()
  stopProgress()
  setProgress(100)
  elements.resultImage.src = url
  elements.downloadBtn.href = url
  elements.lightboxImage.src = url
  setState(States.result)
}

function handleFailure(message) {
  stopPolling()
  stopProgress()
  setProgress(0)
  setState(States.showroom)
  setInlineError(message)
}

function handleRegen() {
  if (!selectedFile) {
    setInlineError('Upload an image to generate again.')
    return
  }
  handleGenerate()
}

function openLightbox() {
  if (!elements.resultImage.src) return
  elements.lightboxImage.src = elements.resultImage.src
  elements.lightbox.classList.remove('hidden')
  elements.lightbox.setAttribute('aria-hidden', 'false')
}

function closeLightbox() {
  elements.lightbox.classList.add('hidden')
  elements.lightbox.setAttribute('aria-hidden', 'true')
}

elements.sidebarToggle.addEventListener('click', () => {
  elements.sidebar.classList.toggle('is-expanded')
})

elements.uploadZone.addEventListener('click', handleUploadClick)

if (elements.uploadZone) {
  elements.uploadZone.addEventListener('keydown', handleUploadKey)
}

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

elements.promptInput.addEventListener('input', updateGenerateState)

elements.presetChips.addEventListener('click', handlePresetClick)

elements.detailStrength.addEventListener('input', handleDetailChange)

elements.generateBtn.addEventListener('click', handleGenerate)

elements.regenBtn.addEventListener('click', handleRegen)

elements.zoomBtn.addEventListener('click', openLightbox)

elements.resultImage.addEventListener('click', openLightbox)

elements.lightboxClose.addEventListener('click', closeLightbox)

elements.lightbox.addEventListener('click', (event) => {
  if (event.target === elements.lightbox) closeLightbox()
})

handleDetailChange()
setState(States.showroom)
updateGenerateState()
