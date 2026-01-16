import { getJob } from '../../lib/jobStore'

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': '*'
    }
  })
}

function statusMessage(status: string) {
  if (status === 'queued') return 'Queued for processing'
  if (status === 'processing') return 'Processing prompt'
  if (status === 'uploading') return 'Uploading result'
  if (status === 'done') return 'Completed'
  return 'Error'
}

export async function onRequestOptions() {
  return jsonResponse({}, 204)
}

export async function onRequestGet(context: any) {
  const { params, env } = context
  const jobId = params?.jobId

  if (!jobId) {
    return jsonResponse({ status: 'error', message: 'missing jobId' }, 400)
  }

  const job = await getJob(env, jobId)
  if (!job) {
    return jsonResponse({ status: 'error', message: 'job not found' }, 404)
  }

  if (job.status === 'done') {
    return jsonResponse({ status: 'done', outputUrl: job.outputUrl })
  }

  if (job.status === 'error') {
    return jsonResponse({ status: 'error', message: job.error || 'generation failed' })
  }

  return jsonResponse({
    status: job.status === 'queued' ? 'processing' : job.status,
    progress: job.progress,
    message: statusMessage(job.status)
  })
}
