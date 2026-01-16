const MOCK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Wv7sAAAAASUVORK5CYII='

function decodeBase64(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function buildPrompt(basePrompt: string, userPrompt: string, presets: string[], options: Record<string, unknown>) {
  const parts = [basePrompt]
  if (userPrompt) parts.push(userPrompt)
  if (presets?.length) parts.push(`Presets: ${presets.join(', ')}`)
  if (options && Object.keys(options).length) {
    parts.push(`Options: ${JSON.stringify(options)}`)
  }
  return parts.join(' | ')
}

export async function generateImage(_input: {
  image: Uint8Array
  prompt: string
}) {
  // Placeholder for real Qwen API call.
  return decodeBase64(MOCK_PNG_BASE64)
}
