import type { JsonRecord, PlayerPageData } from '../types'

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
}

function text(...values: unknown[]) {
  return values.find((value) => typeof value === 'string' && value.trim()) as string | undefined
}

export function musicMeta(data: PlayerPageData) {
  const music = record(data.musicInfo || data.music_info) || data
  const detail = record(data.detail_info || data.detailInfo)
  const song = record(Array.isArray(detail?.songs) ? detail.songs[0] : undefined)
  const album = record(song?.al)
  const artist = record(Array.isArray(song?.ar) ? song.ar[0] : undefined)
  const albumInfo = record(music.album_info || music.albumInfo)
  const lyricInfo = record(data.lyric_info || data.lyricInfo) || record(music.lyric_info || music.lyricInfo)
  return {
    title: text(data.title, music.songname, song?.name, '未知歌曲') || '未知歌曲',
    artist: text(data.authorName, data.artist, music.author_name, music.authorName, artist?.name, '未知歌手') || '未知歌手',
    album: text(album?.name, albumInfo?.name, albumInfo?.album_name),
    cover: text(album?.picUrl, albumInfo?.sizable_cover, albumInfo?.sizableCover, albumInfo?.img),
    lyric: text(lyricInfo?.lrc, lyricInfo?.lyrics, lyricInfo?.lyric, data.lyric, music.lyric),
  }
}
