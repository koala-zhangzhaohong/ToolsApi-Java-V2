export function mediaRouteLabel(value: string, index: number) {
  try {
    const url = new URL(value, window.location.origin)
    const isDouyinVideo = /\/tools\/DouYin\/pro\/player\/video(?:\/|$)/i.test(url.pathname)
    if (isDouyinVideo && url.searchParams.get('proxy') === 'true') {
      return `CDN 线路 ${url.searchParams.get('proxyExtra') || index + 1}`
    }
    if (isDouyinVideo) return '回源线路（原地址）'
    if (/flv/i.test(value)) return '线路 - flv'
    if (/m3u8|hls/i.test(value)) return '线路 - hls'
  } catch {
    // Keep a generic label for malformed or non-URL media values.
  }
  return `线路 ${index + 1}`
}
