export function extractBase64Png(output: any): string | null {
  if (!output) return null
  if (typeof output === 'string' && output.startsWith('data:image/png;base64,')) {
    return output
  }
  if (typeof output === 'object') {
    const value =
      output?.image_base64 ||
      output?.image ||
      output?.images?.[0]?.base64 ||
      output?.images?.[0]
    if (typeof value === 'string') {
      return value.startsWith('data:image/png;base64,') ? value : `data:image/png;base64,${value}`
    }
  }
  return null
}

export function extractOutputImageUrl(output: any): string | null {
  if (!output) return null
  if (typeof output === 'string' && /^https?:\/\//.test(output)) return output
  if (typeof output === 'object') {
    const value =
      output?.url ||
      output?.image_url ||
      output?.result_url ||
      output?.images?.[0] ||
      output?.images?.[0]?.url
    if (typeof value === 'string') return value
  }
  return null
}
