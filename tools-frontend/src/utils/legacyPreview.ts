export function legacyPreviewRoute(value: unknown) {
  const preview = typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? Object.values(value as Record<string, unknown>).find((item): item is string => typeof item === 'string' && item.length > 0)
      : undefined

  if (!preview) return ''
  try {
    const url = new URL(preview, window.location.origin)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return preview
  }
}
