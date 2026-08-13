import type { JsonRecord } from '../types'

export interface MusicSearchState<TType extends string, TResult> {
  version?: number
  keyword: string
  searchedKeyword: string
  type: TType
  limit: number
  result: TResult | null
  rows: JsonRecord[]
  total: number
  hasMore: boolean
  page: number
  scrollY: number
}

const prefix = 'tools-frontend:music-search-state:'
const platformVersions: Record<string, number> = { netease: 2 }

export function readMusicSearchState<TType extends string, TResult>(platform: string) {
  try {
    const raw = sessionStorage.getItem(`${prefix}${platform}`)
    if (!raw) return null
    const state = JSON.parse(raw) as MusicSearchState<TType, TResult>
    const currentVersion = platformVersions[platform]
    if (currentVersion && state.version !== currentVersion) {
      sessionStorage.removeItem(`${prefix}${platform}`)
      return null
    }
    return state
  } catch {
    return null
  }
}

export function saveMusicSearchState<TType extends string, TResult>(platform: string, state: MusicSearchState<TType, TResult>) {
  sessionStorage.setItem(`${prefix}${platform}`, JSON.stringify({
    ...state,
    version: platformVersions[platform],
  }))
}
