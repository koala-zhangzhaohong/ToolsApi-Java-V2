const defaultSpecialNames = ['神秘人', 'dou', '神秘嘉宾']

function nicknameFromUrl(value: string) {
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), window.location.origin)
    return url.searchParams.get('nickname')?.trim() || ''
  } catch {
    return ''
  }
}

export function specialRankRouteLabel(url: string, index: number) {
  const nickname = nicknameFromUrl(url) || defaultSpecialNames[index] || `类型 ${index + 1}`
  return `${nickname} - 用户反查`
}
