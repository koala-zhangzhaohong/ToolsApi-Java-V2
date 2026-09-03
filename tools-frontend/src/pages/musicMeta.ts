import type { JsonRecord, PlayerPageData } from '../types'

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
}

function text(...values: unknown[]) {
  return values.find((value) => typeof value === 'string' && value.trim()) as string | undefined
}

function firstRecord(value: unknown): JsonRecord | undefined {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((item) => {
    const row = record(item)
    return row ? [row] : []
  })[0]
}

function firstNestedRecord(value: unknown): JsonRecord | undefined {
  if (!Array.isArray(value)) return undefined
  return firstRecord(value.flat())
}

function normalizeImage(value: unknown) {
  const url = text(value)
  return url ? url.replace('{size}', '1080') : undefined
}

function decodeBase64Utf8(value?: string) {
  if (!value?.trim()) return undefined
  if (/^\s*\[/.test(value)) return value
  try {
    const binary = atob(value.trim())
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return value
  }
}

export function musicMeta(data: PlayerPageData) {
  const music = record(data.musicInfo || data.music_info || data.music_info_data || data.musicInfoData) || data
  const detail = record(data.detail_info || data.detailInfo)
  const song = firstRecord(detail?.songs)
  const album = record(song?.al)
  const artist = firstRecord(song?.ar)
  const albumInfo = record(music.album_info || music.albumInfo)
  const wrapperAlbum = firstNestedRecord(record(data.album_info || data.albumInfo)?.data)
  const lyricInfo = record(data.lyric_info || data.lyricInfo) || record(data.lyric_info_data || data.lyricInfoData) || record(music.lyric_info || music.lyricInfo)
  const lyricObject = record(lyricInfo?.lrc)
  const lyric = text(
    lyricInfo?.decode_content,
    lyricInfo?.decodeContent,
    lyricObject?.lyric,
    lyricInfo?.lyrics,
    lyricInfo?.lyric,
    data.lyric,
    music.lyric,
    music.lyric_info,
    music.lyricInfo,
  )
  return {
    title: text(data.title, music.songname, song?.name, '未知歌曲') || '未知歌曲',
    artist: text(data.authorName, data.artist, music.author_name, music.authorName, artist?.name, '未知歌手') || '未知歌手',
    album: text(album?.name, albumInfo?.name, albumInfo?.album_name, wrapperAlbum?.album_name),
    cover: normalizeImage(album?.picUrl)
      || normalizeImage(albumInfo?.sizable_cover)
      || normalizeImage(albumInfo?.sizableCover)
      || normalizeImage(albumInfo?.img)
      || normalizeImage(wrapperAlbum?.sizable_cover)
      || normalizeImage(wrapperAlbum?.sizableCover)
      || normalizeImage(wrapperAlbum?.img),
    lyric: decodeBase64Utf8(lyric),
  }
}
