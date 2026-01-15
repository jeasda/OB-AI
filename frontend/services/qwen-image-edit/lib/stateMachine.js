export const States = {
  idle: 'idle',
  imageUploaded: 'image_uploaded',
  readyToGenerate: 'ready_to_generate',
  paymentRequired: 'payment_required',
  generating: 'generating',
  completed: 'completed',
  error: 'error',
  downloading: 'downloading'
}

export const Events = {
  uploadImage: 'UPLOAD_IMAGE',
  removeImage: 'REMOVE_IMAGE',
  setOption: 'SET_OPTION',
  maskDrawn: 'MASK_DRAWN',
  maskCleared: 'MASK_CLEARED',
  openPayment: 'OPEN_PAYMENT',
  confirmPay: 'CONFIRM_PAY',
  cancelPay: 'CANCEL_PAY',
  submit: 'SUBMIT',
  jobAccepted: 'JOB_ACCEPTED',
  jobCompleted: 'JOB_COMPLETED',
  jobFailed: 'JOB_FAILED',
  retry: 'RETRY',
  generateAgain: 'GENERATE_AGAIN',
  downloadStart: 'DOWNLOAD_START',
  downloadDone: 'DOWNLOAD_DONE',
  timeout: 'TIMEOUT'
}

const stateRank = {
  [States.idle]: 0,
  [States.imageUploaded]: 1,
  [States.readyToGenerate]: 2,
  [States.paymentRequired]: 2,
  [States.generating]: 3,
  [States.completed]: 5,
  [States.downloading]: 6,
  [States.error]: 5
}

const resetEvents = new Set([Events.removeImage, Events.generateAgain, Events.cancelPay])

export function createInitialContext(defaults) {
  return {
    imageFile: null,
    options: { ...defaults },
    jobId: null,
    resultUrl: null,
    error: null,
    errorType: null,
    paymentConfirmed: false,
    payMethod: null,
    downloadInProgress: false,
    hasMask: false,
    promptText: '',
    lastEventAt: Date.now()
  }
}

function guardRegression(currentState, nextState, eventType) {
  if (resetEvents.has(eventType)) return false
  if (currentState === States.completed || currentState === States.error) {
    return nextState !== currentState
  }
  return stateRank[nextState] < stateRank[currentState]
}

export function transition(state, context, event) {
  const nextContext = { ...context, lastEventAt: Date.now() }
  let nextState = state

  switch (event.type) {
    case Events.uploadImage: {
      nextContext.imageFile = event.file
      nextContext.error = null
      nextContext.errorType = null
      nextContext.resultUrl = null
      nextContext.hasMask = false
      nextContext.promptText = ''
      nextState = States.imageUploaded
      break
    }
    case Events.removeImage: {
      nextContext.imageFile = null
      nextContext.resultUrl = null
      nextContext.jobId = null
      nextContext.paymentConfirmed = false
      nextContext.payMethod = null
      nextState = States.idle
      break
    }
    case Events.setOption: {
      nextContext.options = { ...nextContext.options, [event.key]: event.value }
      nextState = nextContext.imageFile
        ? (nextContext.hasMask ? States.readyToGenerate : States.imageUploaded)
        : States.idle
      break
    }
    case Events.maskDrawn: {
      nextContext.hasMask = true
      nextContext.error = null
      nextContext.errorType = null
      nextState = nextContext.imageFile ? States.readyToGenerate : States.idle
      break
    }
    case Events.maskCleared: {
      nextContext.hasMask = false
      nextState = nextContext.imageFile ? States.imageUploaded : States.idle
      break
    }
    case Events.openPayment: {
      nextState = States.paymentRequired
      break
    }
    case Events.confirmPay: {
      nextContext.paymentConfirmed = true
      nextContext.payMethod = event.method
      nextState = States.paymentRequired
      break
    }
    case Events.cancelPay: {
      nextContext.paymentConfirmed = false
      nextContext.payMethod = null
      nextState = nextContext.imageFile
        ? (nextContext.hasMask ? States.readyToGenerate : States.imageUploaded)
        : States.idle
      break
    }
    case Events.submit: {
      if (!nextContext.imageFile) {
        nextContext.error = 'missing_image'
        nextContext.errorType = 'validation'
        nextState = States.error
      } else {
        nextState = States.generating
      }
      break
    }
    case Events.jobAccepted: {
      nextContext.jobId = event.jobId
      nextState = States.generating
      break
    }
    case Events.jobCompleted: {
      nextContext.resultUrl = event.resultUrl
      nextContext.error = null
      nextContext.errorType = null
      nextState = States.completed
      break
    }
    case Events.jobFailed: {
      nextContext.error = event.error || 'job_failed'
      nextContext.errorType = event.errorType || 'api'
      nextState = States.error
      break
    }
    case Events.retry: {
      if (!nextContext.imageFile) {
        nextState = States.idle
      } else {
        nextState = States.generating
      }
      break
    }
    case Events.generateAgain: {
      nextContext.resultUrl = null
      nextContext.jobId = null
      nextContext.error = null
      nextContext.errorType = null
      nextState = nextContext.imageFile
        ? (nextContext.hasMask ? States.readyToGenerate : States.imageUploaded)
        : States.idle
      break
    }
    case Events.downloadStart: {
      nextContext.downloadInProgress = true
      nextState = States.downloading
      break
    }
    case Events.downloadDone: {
      nextContext.downloadInProgress = false
      nextState = States.completed
      break
    }
    case Events.timeout: {
      nextContext.error = 'timeout'
      nextContext.errorType = 'timeout'
      nextState = States.error
      break
    }
    default:
      nextState = state
  }

  if (guardRegression(state, nextState, event.type)) {
    return { state, context: nextContext }
  }

  return { state: nextState, context: nextContext }
}

export function deriveFlags(state, context) {
  const hasImage = !!context.imageFile
  const isBusy = state === States.generating || state === States.downloading
  const canSubmit = state === States.readyToGenerate && !isBusy

  return {
    hasImage,
    isBusy,
    canSubmit,
    showProgress: state === States.generating,
    showResult: state === States.completed || state === States.downloading,
    showError: state === States.error,
    showPayment: state === States.paymentRequired,
    canDownload: state === States.completed || state === States.downloading
  }
}
