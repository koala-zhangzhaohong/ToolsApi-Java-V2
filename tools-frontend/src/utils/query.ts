export function decodeUrlSafeBase64(value: string | null): string {
  if (!value) return ''
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return value
  }
}

export function firstNonEmpty(...values: Array<string | null | undefined>): string {
  return values.find((value) => value && value.trim())?.trim() || ''
}
