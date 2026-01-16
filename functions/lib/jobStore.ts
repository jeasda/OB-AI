export type JobStatus = 'queued' | 'processing' | 'uploading' | 'done' | 'error'

export type JobRecord = {
  jobId: string
  status: JobStatus
  progress: number
  createdAt: string
  updatedAt: string
  outputUrl?: string
  error?: string
}

const memoryStore = new Map<string, JobRecord>()

function nowIso() {
  return new Date().toISOString()
}

function getKv(env: any) {
  return env?.JOBS_KV || env?.JOB_KV || env?.OB_JOBS || null
}

export async function createJob(env: any) {
  const jobId = crypto.randomUUID()
  const createdAt = nowIso()
  const job: JobRecord = {
    jobId,
    status: 'queued',
    progress: 5,
    createdAt,
    updatedAt: createdAt
  }
  await saveJob(env, job)
  return job
}

export async function getJob(env: any, jobId: string): Promise<JobRecord | null> {
  const kv = getKv(env)
  if (kv) {
    const stored = await kv.get(jobId, 'json')
    return stored || null
  }
  return memoryStore.get(jobId) || null
}

export async function updateJob(env: any, jobId: string, updates: Partial<JobRecord>) {
  const existing = await getJob(env, jobId)
  if (!existing) return null
  const next: JobRecord = {
    ...existing,
    ...updates,
    updatedAt: nowIso()
  }
  await saveJob(env, next)
  return next
}

export async function saveJob(env: any, job: JobRecord) {
  const kv = getKv(env)
  if (kv) {
    await kv.put(job.jobId, JSON.stringify(job))
    return
  }
  memoryStore.set(job.jobId, job)
}
