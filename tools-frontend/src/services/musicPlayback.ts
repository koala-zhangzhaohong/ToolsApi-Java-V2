import type { JsonRecord, PlayerPageData } from '../types'
import { getJson, readableApiError } from './http'
import type { NeteaseQuality } from './netease'

export type MusicPlatform = 'netease' | 'kugou'

export interface MusicPlaybackPayload {
  platform: MusicPlatform
  data: PlayerPageData
  sources: string[]
  sourceLabels?: string[]
  createdAt: number
}

export interface MusicQualityOption {
  value: NeteaseQuality
  label: string
}

const neteaseQualityLabels: Record<NeteaseQuality, string> = {
  default: '流畅',
  standard: '标准',
  exhigh: '极高',
  lossless: '无损',
  hires: 'Hi-Res',
}

const neteaseQualityOrder = Object.keys(neteaseQualityLabels) as NeteaseQuality[]

interface ApiResponse<T> extends JsonRecord {
  code?: number
  message?: string
  data?: T
}

const storagePrefix = 'tools-frontend:music-playback:'
const legacyPlayerPath = /\/tools\/(?:Netease|Kugou)\/pro\/player\//i
const internalHost = /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1|192\.168(?:\.\d{1,3}){2}|10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/i
const internalMediaPath = /\/(?:api\/frontend\/pages\/media|tools\/(?:Netease|Kugou)\/pro\/player)\b/i

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
}

function recordList(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.flatMap((item) => {
    const row = record(item)
    return row ? [row] : []
  }) : []
}

function objectUrls(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (Array.isArray(value)) return value.flatMap(objectUrls)
  if (value && typeof value === 'object') return Object.values(value).flatMap(objectUrls)
  return []
}

function mediaSource(value: unknown) {
  if (typeof value !== 'string') return ''
  const source = value.trim()
  if (!source) return ''
  try {
    const parsed = new URL(source, window.location.origin)
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    if (legacyPlayerPath.test(parsed.pathname)) return ''
    if (parsed.pathname === '/short' && parsed.searchParams.has('key')) return parsed.origin === window.location.origin ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString()
    if (internalHost.test(parsed.hostname) || internalMediaPath.test(parsed.pathname)) return ''
    if (parsed.origin === window.location.origin) return `${parsed.pathname}${parsed.search}${parsed.hash}`
    return parsed.toString()
  } catch {
    return ''
  }
}

function uniqueSources(values: unknown[]) {
  return [...new Set(values.flatMap(objectUrls).map(mediaSource).filter(Boolean))]
}

function assertSuccess<T>(response: ApiResponse<T>, fallback: string): T {
  if (typeof response.code === 'number' && response.code !== 200) {
    throw new Error(readableApiError(response.message, `${fallback}（业务码 ${response.code}）`))
  }
  if (response.data === undefined || response.data === null) throw new Error(fallback)
  return response.data
}

export function collectNeteasePlaybackSources(data: PlayerPageData) {
  const item = record(data.item_info || data.itemInfo)
  const itemData = recordList(item?.data)
  return uniqueSources(itemData.flatMap((row) => [
    row.cdn_url,
    row.cdnUrl,
    row.url,
    row.play_url,
    row.playUrl,
    row.backup_url,
    row.backupUrl,
    row.mock_preview_path,
    row.mockPreviewPath,
  ]))
}

export function neteasePlaybackInfo(data: PlayerPageData) {
  const item = record(data.item_info || data.itemInfo)
  const itemData = recordList(item?.data)
  const web = record(data.web_player_info || data.webPlayerInfo)
  const playerUrls = record(web?.player_url_list || web?.playerUrlList)
  const detail = record(data.detail_info || data.detailInfo)
  const songs = recordList(detail?.songs)
  const rawId = web?.id || songs[0]?.id
  const rawQuality = web?.quality || itemData[0]?.level
  const currentQuality = neteaseQualityOrder.includes(rawQuality as NeteaseQuality)
    ? rawQuality as NeteaseQuality
    : 'standard'
  const available = new Set(Object.keys(playerUrls || {}).filter((quality): quality is NeteaseQuality => neteaseQualityOrder.includes(quality as NeteaseQuality)))
  available.add(currentQuality)
  return {
    songId: typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '',
    currentQuality,
    qualities: neteaseQualityOrder
      .filter((quality) => available.has(quality))
      .map((value) => ({ value, label: neteaseQualityLabels[value] })),
    source: collectNeteasePlaybackSources(data)[0] || '',
  }
}

function kugouMusicInfo(data: PlayerPageData) {
  return record(data.music_info_data || data.musicInfoData) || record(data.music_info || data.musicInfo) || data
}

function kugouAlbumId(data: PlayerPageData) {
  const music = kugouMusicInfo(data)
  const album = record(music.album_info || music.albumInfo)
  const albumData = record(data.album_info || data.albumInfo)?.data
  const wrapperRows = recordList(Array.isArray(albumData) ? albumData.flat() : albumData)
  const wrapperAlbum = recordList(wrapperRows[0])[0] || wrapperRows[0]
  const value = album?.album_id || album?.albumId || wrapperAlbum?.album_id || wrapperAlbum?.albumId
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

function kugouQualityCandidates(data: PlayerPageData) {
  const music = kugouMusicInfo(data)
  const audio = record(music.audio_info || music.audioInfo)
  const playList = record(audio?.play_info_list || audio?.playInfoList)
  const qualityMap: Array<[string, number, string]> = [
    ['default', 0, '标准'],
    ['128', 1, '标准'],
    ['320', 2, '高品质'],
    ['flac', 3, '无损'],
    ['high', 4, 'Hi-Res'],
  ]
  const hashes = new Set<string>()
  return qualityMap.flatMap(([quality, id, label]) => {
    const row = record(playList?.[quality])
    const hash = row?.hash
    if (typeof hash !== 'string' || !hash.trim() || hashes.has(hash.trim())) return []
    hashes.add(hash.trim())
    return [{ quality, id, label, hash: hash.trim() }]
  })
}

export async function collectKugouPlaybackOptions(data: PlayerPageData) {
  const albumId = kugouAlbumId(data)
  const candidates = kugouQualityCandidates(data)
  if (!albumId) throw new Error('酷狗歌曲缺少专辑 ID，无法请求播放地址')
  if (!candidates.length) throw new Error('酷狗歌曲没有返回可用音质信息，可能受版权限制')
  const failures: string[] = []
  const results = await Promise.all(candidates.map(async ({ hash, id, label }) => {
    try {
      const query = new URLSearchParams({
        hash,
        albumId,
        quality: String(id),
        version: '3',
      })
      const response = await getJson<ApiResponse<JsonRecord>>(`/tools/Kugou/api/playInfo?${query.toString()}`)
      const data = assertSuccess(response, '酷狗播放地址解析失败')
      const payload = record(data.data) || data
      const sources = uniqueSources([
        payload.url,
        payload.urls,
        payload.play_url,
        payload.playUrl,
        payload.backup_url,
        payload.backupUrl,
        payload.file_url,
        payload.fileUrl,
      ])
      return sources.map((source, index) => ({ source, label: `${label} - 线路 ${index + 1}` }))
    } catch (error) {
      failures.push(error instanceof Error ? error.message : `${label}解析失败`)
      return []
    }
  }))
  const options = results.flat()
  if (!options.length) throw new Error(failures[0] || '酷狗歌曲已解析，但没有返回可播放地址')
  return options
}

export function saveMusicPlayback(platform: MusicPlatform, data: PlayerPageData, sources: string[], sourceLabels?: string[]) {
  const key = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const payload: MusicPlaybackPayload = { platform, data, sources, sourceLabels, createdAt: Date.now() }
  sessionStorage.setItem(`${storagePrefix}${key}`, JSON.stringify(payload))
  return key
}

export function readMusicPlayback(key: string) {
  try {
    const raw = sessionStorage.getItem(`${storagePrefix}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const payload = parsed as MusicPlaybackPayload
    if (!Array.isArray(payload.sources) || !payload.data) return null
    const sources = payload.platform === 'netease'
      ? collectNeteasePlaybackSources(payload.data)
      : uniqueSources(payload.sources)
    return { ...payload, sources }
  } catch {
    return null
  }
}
