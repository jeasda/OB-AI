export async function uploadResult(env: any, jobId: string, bytes: Uint8Array) {
  const bucket = env?.R2_RESULTS
  if (!bucket) {
    throw new Error('R2_RESULTS binding is missing')
  }

  const key = `qwen-image-edit/${jobId}.png`
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: 'image/png' }
  })

  const base = env?.R2_PUBLIC_BASE
  if (!base) {
    throw new Error('R2_PUBLIC_BASE is missing')
  }

  return `${String(base).replace(/\/$/, '')}/${key}`
}
