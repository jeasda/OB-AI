const States = {
  idle: 'idle',
  processing: 'processing',
  done: 'done',
  error: 'error'
}

const STATUS_LABELS = {
  uploading: 'Uploading image',
  processing: 'Processing prompt',
  generating: 'Generating result',
  finalizing: 'Finalizing output'
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

const API_CREATE = '/api/qwen-image-edit'
const API_STATUS = '/api/job'
const MOCK_API = true
const mockJobs = new Map()

let selectedFile = null
let previewUrl = ''
let pollTimer = null

let machine = {
  state: States.idle,
  context: {
    jobId: null,
    resultUrl: '',
    error: '',
    progress: 0,
    statusText: STATUS_LABELS.uploading
  }
}

function transition(event) {
  machine = reduceState(machine.state, machine.context, event)
  render()
}

function reduceState(state, context, event) {
  const next = { ...context }

  switch (event.type) {
    case 'SUBMIT':
      return {
        state: States.processing,
        context: {
          ...next,
          jobId: null,
          resultUrl: '',
          error: '',
          progress: 0,
          statusText: STATUS_LABELS.uploading
        }
      }
    case 'JOB_ACCEPTED':
      return {
        state: state === States.processing ? state : States.processing,
        context: {
          ...next,
          jobId: event.jobId
        }
      }
    case 'JOB_PROGRESS':
      return {
        state: state === States.processing ? state : States.processing,
        context: {
          ...next,
          progress: event.progress ?? next.progress,
          statusText: event.statusText ?? next.statusText
        }
      }
    case 'JOB_DONE':
      return {
        state: States.done,
        context: {
          ...next,
          resultUrl: event.resultUrl,
          progress: 100,
          statusText: STATUS_LABELS.finalizing
        }
      }
    case 'JOB_FAILED':
      return {
        state: States.error,
        context: {
          ...next,
          error: event.error || 'Generation failed.',
          progress: 0
        }
      }
    case 'RESET':
      return {
        state: States.idle,
        context: {
          ...next,
          error: ''
        }
      }
    default:
      return { state, context }
  }
}

function render() {
  const { state, context } = machine
  const isProcessing = state === States.processing
  const isDone = state === States.done

  elements.showroom.classList.toggle('is-active', state === States.idle || state === States.error)
  elements.processing.classList.toggle('is-active', isProcessing)
  elements.result.classList.toggle('is-active', isDone)

  elements.body.classList.toggle('is-busy', isProcessing)
  elements.body.setAttribute('aria-busy', String(isProcessing))

  setControlsDisabled(isProcessing)
  setInlineError(state === States.error ? context.error : '')
  setProgress(context.progress)
  setStatus(context.statusText)

  if (isDone && context.resultUrl) {
    elements.resultImage.src = context.resultUrl
    elements.downloadBtn.href = context.resultUrl
    elements.lightboxImage.src = context.resultUrl
  }
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

function startPolling() {
  stopPolling()
  pollTimer = setInterval(checkStatus, 2000)
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
  elements.generateBtn.disabled = !isFormReady() || machine.state === States.processing
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

  transition({ type: 'SUBMIT' })

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

    const data = await createJobRequest(formData)
    if (!data.ok) {
      throw new Error(data.error || 'Failed to start generation.')
    }

    const id = data.job_id || data.jobId || data.job?.id
    if (!id) throw new Error('Job ID missing from response.')

    transition({ type: 'JOB_ACCEPTED', jobId: id })
    startPolling()
  } catch (error) {
    transition({ type: 'JOB_FAILED', error: error.message || 'Generation failed.' })
  }
}

async function checkStatus() {
  if (!machine.context.jobId) return

  try {
    const data = await getJobStatus(machine.context.jobId)
    if (!data.ok) {
      throw new Error(data.error || 'Failed to fetch job status.')
    }

    const status = data.job?.status
    if (status === 'done') {
      const resultUrl = data.job?.result_url || previewUrl
      if (!resultUrl) throw new Error('Missing result URL.')
      stopPolling()
      transition({ type: 'JOB_DONE', resultUrl })
      return
    }

    if (status === 'error') {
      throw new Error('Generation failed on the server.')
    }

    transition({
      type: 'JOB_PROGRESS',
      progress: data.job?.progress ?? machine.context.progress,
      statusText: mapStatusText(status)
    })
  } catch (error) {
    stopPolling()
    transition({ type: 'JOB_FAILED', error: error.message || 'Generation failed.' })
  }
}

function mapStatusText(status) {
  if (status === 'uploading') return STATUS_LABELS.uploading
  if (status === 'processing') return STATUS_LABELS.processing
  if (status === 'generating') return STATUS_LABELS.generating
  if (status === 'finalizing') return STATUS_LABELS.finalizing
  return STATUS_LABELS.processing
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

async function createJobRequest(formData) {
  if (MOCK_API) {
    return mockCreateJob(previewUrl)
  }

  const response = await fetch(API_CREATE, {
    method: 'POST',
    body: formData
  })
  const data = await response.json()
  return response.ok ? data : { ok: false, error: data?.error || 'Request failed.' }
}

async function getJobStatus(id) {
  if (MOCK_API) {
    return mockGetJob(id)
  }

  const response = await fetch(`${API_STATUS}/${id}`)
  const data = await response.json()
  return response.ok ? data : { ok: false, error: data?.error || 'Status failed.' }
}

function mockCreateJob(resultUrl) {
  const id = crypto.randomUUID()
  mockJobs.set(id, {
    id,
    createdAt: Date.now(),
    resultUrl
  })
  return Promise.resolve({ ok: true, job_id: id })
}

function mockGetJob(id) {
  const job = mockJobs.get(id)
  if (!job) {
    return Promise.resolve({ ok: false, error: 'Job not found.' })
  }

  const elapsed = Date.now() - job.createdAt
  const progress = Math.min(100, Math.floor(elapsed / 120))
  let status = 'uploading'
  if (progress >= 100) {
    status = 'done'
  } else if (progress >= 90) {
    status = 'finalizing'
  } else if (progress >= 60) {
    status = 'generating'
  } else if (progress >= 25) {
    status = 'processing'
  }

  return Promise.resolve({
    ok: true,
    job: {
      id,
      status,
      progress,
      result_url: job.resultUrl
    }
  })
}

elements.sidebarToggle.addEventListener('click', () => {
  elements.sidebar.classList.toggle('is-expanded')
})

elements.uploadZone.addEventListener('click', handleUploadClick)

elements.uploadZone.addEventListener('keydown', handleUploadKey)

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
render()
updateGenerateState()
