import { CustomerServiceOutlined, ExpandOutlined, HomeOutlined, LinkOutlined, PauseCircleFilled, PlayCircleFilled, PictureOutlined, ReloadOutlined, SoundOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Card, Carousel, Image, Result, Select, Slider, Space, Spin, Tag, Tooltip, Typography } from 'antd'
import flvjs from 'flv.js'
import Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { apiUrl, getJson } from '../services/http'
import type { JsonRecord, PlayerPageData } from '../types'
import { decodeUrlSafeBase64, firstNonEmpty } from '../utils/query'

type LegacyMedia = 'video' | 'live' | 'music' | 'picture'
type VideoTransport = 'native' | 'flv' | 'hls'

interface ZwPlayerInstance {
  paused?: boolean
  pause?: () => void
  destroy: () => void
}

interface ZwPlayerConstructor {
  new(options: {
    playerElm: string
    url: Array<{ name: string; url: string; type?: string; default?: boolean }>
    infoButton: boolean
    optionButton: boolean
    snapshotButton: boolean
    controlbar: boolean
    autoplay: boolean
    isLive: boolean
    onready?: () => void
    onmediaevent?: (event: Event) => void
  }): ZwPlayerInstance
}

declare global {
  interface Window {
    ZWPlayer?: ZwPlayerConstructor
  }
}

let zwPlayerLoader: Promise<ZwPlayerConstructor> | undefined

function loadZwPlayer() {
  if (window.ZWPlayer) return Promise.resolve(window.ZWPlayer)
  if (!zwPlayerLoader) {
    zwPlayerLoader = new Promise((resolve, reject) => {
      const stylesheet = document.createElement('link')
      stylesheet.rel = 'stylesheet'
      stylesheet.href = '/legacy-assets/js/zwplayer/css/zwplayer.css?v=2026'
      document.head.appendChild(stylesheet)
      const script = document.createElement('script')
      script.src = '/legacy-assets/js/zwplayer/zwplayer.js?v=2026'
      script.onload = () => window.ZWPlayer ? resolve(window.ZWPlayer) : reject(new Error('ZWPlayer 初始化失败'))
      script.onerror = () => reject(new Error('ZWPlayer 资源加载失败'))
      document.head.appendChild(script)
    })
  }
  return zwPlayerLoader
}

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined
}

function text(...values: unknown[]) {
  return values.find((value) => typeof value === 'string' && value.trim()) as string | undefined
}

function routeInfo(pathname: string) {
  const platform = /\/DouYin\//i.test(pathname) ? 'douyin' : /\/Netease\//i.test(pathname) ? 'netease' : 'kugou'
  const media: LegacyMedia = /picture/i.test(pathname) ? 'picture' : /music/i.test(pathname) ? 'music' : /live/i.test(pathname) ? 'live' : 'video'
  return { platform, media }
}

function objectUrls(value: unknown): string[] {
  if (typeof value === 'string' && value) return [value]
  if (Array.isArray(value)) return value.flatMap(objectUrls)
  if (value && typeof value === 'object') return Object.values(value).flatMap(objectUrls)
  return []
}

function proxyVideoSources(data: PlayerPageData, params: URLSearchParams) {
  if (params.get('proxy') !== 'true' || !Array.isArray(data.proxyMultiVideoQualityInfoList)) return []
  const requested = Number.parseInt(params.get('proxyExtra') || '1', 10)
  const index = Number.isFinite(requested) && requested > 0 ? requested - 1 : 0
  return objectUrls(data.proxyMultiVideoQualityInfoList[index] || data.proxyMultiVideoQualityInfoList[0])
}

function sourceList(data: PlayerPageData, media: LegacyMedia, params: URLSearchParams) {
  if (media === 'picture') return objectUrls(data.data)
  if (media === 'live') {
    const live = data.multiLiveQualityInfo?.[params.get('type') || 'flv'] || data.multiLiveQualityInfo
    return objectUrls(live)
  }
  if (media === 'video') {
    const proxySources = proxyVideoSources(data, params)
    if (proxySources.length) return proxySources
    if (data.multiVideoQualityInfo || data.multiMvQualityInfo) return objectUrls(data.multiVideoQualityInfo || data.multiMvQualityInfo)
    if (Array.isArray(data.mvInfo)) return data.mvInfo.flatMap((value) => objectUrls(record(value)?.path))
    return objectUrls(data.path || data.proxyPath)
  }
  const web = record(data.web_player_info || data.webPlayerInfo)
  const item = record(data.item_info || data.itemInfo)
  const itemData = Array.isArray(item?.data) ? item.data : []
  return [...objectUrls(web?.player_url_list || web?.playerUrlList), ...itemData.flatMap((value) => {
    const row = record(value)
    return objectUrls(row?.cdn_url || row?.cdnUrl || row?.url)
  })]
}

async function kugouMusicSources(data: PlayerPageData) {
  const music = record(data.musicInfo || data.music_info)
  const audio = record(music?.audio_info || music?.audioInfo)
  const list = record(audio?.play_info_list || audio?.playInfoList)
  const album = record(music?.album_info || music?.albumInfo)
  const albumId = album?.album_id || album?.albumId
  if (!list || !albumId) return []
  const candidates = ['128', '320', 'high', 'flac'].flatMap((key) => {
    const info = record(list[key])
    return typeof info?.hash === 'string' ? [info.hash] : []
  })
  const resolved = await Promise.all(candidates.map(async (hash) => {
    try {
      const response = await getJson<{ data?: { url?: string[] } }>(`/tools/Kugou/api/playInfo?hash=${encodeURIComponent(hash)}&albumId=${encodeURIComponent(String(albumId))}`)
      return response.data?.url || []
    } catch { return [] }
  }))
  return resolved.flat().filter(Boolean)
}

function proxiedMediaUrl(src: string, useCdnProxy = false) {
  if (useCdnProxy) return src
  try {
    const url = new URL(src, window.location.origin)
    const key = url.pathname === '/short' ? url.searchParams.get('key') : null
    return key ? apiUrl(`/api/frontend/pages/media?key=${encodeURIComponent(key)}`) : src
  } catch {
    return src
  }
}

function playerMediaUrl(src: string, transport: VideoTransport, useCdnProxy = false) {
  const proxied = proxiedMediaUrl(src, useCdnProxy)
  if (transport === 'native') return proxied
  const url = new URL(proxied, window.location.origin)
  url.searchParams.set('mime_type', `video_${transport}`)
  return url.origin === window.location.origin ? `${url.pathname}${url.search}` : url.toString()
}

function qualityName(index: number, total: number) {
  const fourLevels = ['原画', '超清', '高清', '标清']
  const twoLevels = ['高清', '标清']
  return (total >= 4 ? fourLevels[index] : total === 2 ? twoLevels[index] : undefined) || `线路 ${index + 1}`
}

function OriginalZwPlayer({ sources, live, transport, useCdnProxy, onError }: { sources: string[]; live: boolean; transport: VideoTransport; useCdnProxy: boolean; onError: (message: string) => void }) {
  const elementId = useRef(`zw-player-${Math.random().toString(36).slice(2)}`)
  useEffect(() => {
    const playerElementId = elementId.current
    let disposed = false
    let player: ZwPlayerInstance | undefined
    let streamCleanup: (() => void) | undefined
    let streamTimer: number | undefined
    let activeSourceIndex = sources.length > 1 ? 1 : 0
    let removeQualityListener: (() => void) | undefined
    const attachStream = (sourceIndex = activeSourceIndex) => {
      activeSourceIndex = sourceIndex
      streamCleanup?.()
      const video = document.getElementById(playerElementId)?.querySelector('video')
      if (!video || transport === 'native') return
      const selectedSource = sources[activeSourceIndex]
      const playbackUrl = proxiedMediaUrl(selectedSource, useCdnProxy)
      if (transport === 'flv' && flvjs.isSupported()) {
        const stream = flvjs.createPlayer({ type: 'flv', isLive: live, url: playbackUrl }, { enableStashBuffer: !live })
        stream.on(flvjs.Events.ERROR, (_, detail) => onError(`FLV 播放失败：${String(detail)}`))
        video.removeAttribute('src')
        video.load()
        stream.attachMediaElement(video)
        stream.load()
        video.muted = live
        void stream.play().catch(() => undefined)
        streamCleanup = () => { stream.pause(); stream.unload(); stream.detachMediaElement(); stream.destroy() }
      } else if (transport === 'hls' && Hls.isSupported()) {
        const stream = new Hls({ lowLatencyMode: live })
        stream.on(Hls.Events.ERROR, (_, event) => { if (event.fatal) onError(`HLS 播放失败：${event.details}`) })
        video.removeAttribute('src')
        video.load()
        stream.loadSource(playbackUrl)
        stream.attachMedia(video)
        video.muted = live
        void video.play().catch(() => undefined)
        streamCleanup = () => stream.destroy()
      }
    }
    loadZwPlayer().then((ZWPlayer) => {
      if (disposed) return
      player = new ZWPlayer({
        playerElm: playerElementId,
        url: sources.map((source, index) => ({
          name: qualityName(index, sources.length),
          url: transport === 'native' ? playerMediaUrl(source, transport, useCdnProxy) : proxiedMediaUrl(source, useCdnProxy),
          type: transport === 'native' ? undefined : 'mp4',
          default: index === (sources.length > 1 ? 1 : 0),
        })),
        infoButton: true,
        optionButton: true,
        snapshotButton: true,
        controlbar: true,
        autoplay: true,
        isLive: live,
        onready: () => onError(''),
        onmediaevent: (event) => {
          if (event.type === 'error') {
            onError('媒体播放失败，正在重新连接')
            window.clearTimeout(streamTimer)
            streamTimer = window.setTimeout(attachStream, 500)
          }
        },
      })
      const playerElement = document.getElementById(playerElementId)
      const handleQualityClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null
        if (target?.closest('.zwp-playbtn')) {
          const video = playerElement?.querySelector('video')
          const shouldPlay = Boolean(video?.paused)
          window.setTimeout(() => {
            if (!video) return
            if (shouldPlay) void video.play().catch(() => undefined)
            else video.pause()
          })
          return
        }
        const label = target?.closest('li,button,div')?.textContent?.trim()
        const sourceIndex = sources.findIndex((_, index) => qualityName(index, sources.length) === label)
        if (sourceIndex < 0 || sourceIndex === activeSourceIndex) return
        window.clearTimeout(streamTimer)
        streamTimer = window.setTimeout(() => attachStream(sourceIndex), 300)
      }
      playerElement?.addEventListener('click', handleQualityClick, true)
      removeQualityListener = () => playerElement?.removeEventListener('click', handleQualityClick, true)
      streamTimer = window.setTimeout(attachStream, 500)
    }).catch((reason) => onError(reason instanceof Error ? reason.message : '播放器加载失败'))
    return () => {
      disposed = true
      window.clearTimeout(streamTimer)
      streamCleanup?.()
      removeQualityListener?.()
      try {
        player?.pause?.()
        player?.destroy()
      } catch { /* player may already be disposed internally */ }
      document.getElementById(playerElementId)?.replaceChildren()
    }
  }, [live, onError, sources, transport, useCdnProxy])
  return <div id={elementId.current} className="zw-video-player-custom legacy-original-player" />
}

function NativeVideo({ src, live, transport, useCdnProxy, onError }: { src: string; live: boolean; transport: VideoTransport; useCdnProxy: boolean; onError: (message: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video || !src) return
    const playbackUrl = proxiedMediaUrl(src, useCdnProxy)
    const useHls = transport === 'hls' || /\.m3u8(?:\?|$)/i.test(src)
    const useFlv = transport === 'flv' || /\.flv(?:\?|$)/i.test(src)
    if (useHls && Hls.isSupported()) {
      const player = new Hls({ lowLatencyMode: live })
      player.on(Hls.Events.ERROR, (_, event) => { if (event.fatal) onError(`HLS 播放失败：${event.details}`) })
      player.loadSource(playbackUrl)
      player.attachMedia(video)
      return () => player.destroy()
    }
    if (useFlv && flvjs.isSupported()) {
      const player = flvjs.createPlayer({ type: 'flv', isLive: live, url: playbackUrl }, { enableStashBuffer: !live })
      player.on(flvjs.Events.ERROR, (_, detail) => onError(`FLV 播放失败：${detail}`))
      player.attachMediaElement(video)
      player.load()
      void player.play().catch(() => undefined)
      return () => { player.pause(); player.unload(); player.detachMediaElement(); player.destroy() }
    }
    video.src = playbackUrl
  }, [src, live, transport, useCdnProxy, onError])
  return <video ref={ref} controls playsInline autoPlay={live} muted={live} className="legacy-media-video" onCanPlay={() => onError('')} onError={() => onError('媒体地址不可播放，链接可能已经过期')} />
}

function musicMeta(data: PlayerPageData) {
  const music = record(data.musicInfo || data.music_info) || data
  const detail = record(data.detail_info || data.detailInfo)
  const songs = Array.isArray(detail?.songs) ? detail.songs : []
  const song = record(songs[0])
  const album = record(song?.al)
  const artists = Array.isArray(song?.ar) ? song.ar : []
  const artist = record(artists[0])
  const albumInfo = record(music.album_info || music.albumInfo)
  return {
    title: text(data.title, music.songname, song?.name, '未知歌曲')!,
    artist: text(data.authorName, data.artist, music.author_name, music.authorName, artist?.name, '未知歌手')!,
    cover: text(album?.picUrl, albumInfo?.sizable_cover, albumInfo?.sizableCover, albumInfo?.img),
    lyric: text(record(data.lyric_info || data.lyricInfo)?.lrc, record(music.lyric_info || music.lyricInfo)?.lyrics, record(music.lyric_info || music.lyricInfo)?.lyric),
  }
}

function AdvancedMusicPlayer({ data, sources }: { data: PlayerPageData; sources: string[] }) {
  const meta = musicMeta(data)
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [quality, setQuality] = useState(0)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(75)
  const [speed, setSpeed] = useState(1)
  const src = sources[quality] || sources[0]
  useEffect(() => { if (audio.current) { audio.current.volume = volume / 100; audio.current.playbackRate = speed } }, [volume, speed])
  const toggle = () => {
    const node = audio.current
    if (!node) return
    if (node.paused) void node.play(); else node.pause()
  }
  return <div className="advanced-music" style={meta.cover ? { backgroundImage: `linear-gradient(rgba(8,10,18,.72),rgba(8,10,18,.92)),url(${meta.cover})` } : undefined}>
    <div className={`music-disc ${playing ? 'is-playing' : ''}`}>{meta.cover ? <img src={meta.cover} alt="专辑封面" /> : <CustomerServiceOutlined />}</div>
    <div className="music-main">
      <Typography.Text className="music-kicker">NOW PLAYING</Typography.Text>
      <Typography.Title level={2}>{meta.title}</Typography.Title><Typography.Text className="music-artist">{meta.artist}</Typography.Text>
      <div className="music-wave">{Array.from({ length: 34 }, (_, i) => <i key={i} style={{ height: `${18 + ((i * 17) % 52)}%` }} />)}</div>
      {meta.lyric && <div className="music-lyric">{meta.lyric.replace(/\[[^\]]+]/g, '').split(/\r?\n/).filter(Boolean).slice(0, 3).join(' · ')}</div>}
      <Slider value={progress} max={duration || 100} tooltip={{ formatter: (value) => `${Math.floor(Number(value) / 60)}:${String(Math.floor(Number(value) % 60)).padStart(2, '0')}` }} onChange={(value) => { setProgress(value); if (audio.current) audio.current.currentTime = value }} />
      <div className="music-controls">
        <Space><Button type="text" className="music-play" icon={playing ? <PauseCircleFilled /> : <PlayCircleFilled />} onClick={toggle} /><SoundOutlined /><Slider className="volume-slider" value={volume} onChange={setVolume} /></Space>
        <Space><Select aria-label="播放速度" value={speed} onChange={setSpeed} options={[.5, .75, 1, 1.25, 1.5, 2].map((value) => ({ value, label: `${value}x` }))} />{sources.length > 1 && <Select aria-label="音质" value={quality} onChange={setQuality} options={sources.map((_, index) => ({ value: index, label: `音质 ${index + 1}` }))} />}<Tooltip title="全屏"><Button type="text" aria-label="全屏" icon={<ExpandOutlined />} onClick={() => document.documentElement.requestFullscreen?.()} /></Tooltip></Space>
      </div>
    </div>
    <audio ref={audio} src={src} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)} />
  </div>
}

export default function LegacyPlayerPage() {
  const location = useLocation()
  const [params] = useSearchParams()
  const info = useMemo(() => routeInfo(location.pathname), [location.pathname])
  const defaultVersion = info.platform === 'douyin' && info.media === 'video' && /\/short\/?$/i.test(location.pathname)
    ? '4'
    : info.platform === 'douyin' && info.media === 'live' && /\/short\/?$/i.test(location.pathname)
      ? '3'
      : '2'
  const version = params.get('version') || defaultVersion
  const direct = firstNonEmpty(decodeUrlSafeBase64(params.get('path')), params.get('path'), params.get('src'))
  const [data, setData] = useState<PlayerPageData>({})
  const [sources, setSources] = useState<string[]>(direct ? [direct] : [])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(Boolean(params.get('key')))
  const [error, setError] = useState('')
  const [playbackError, setPlaybackError] = useState('')

  useEffect(() => {
    const key = params.get('key')
    if (!key) return
    setLoading(true); setError('')
    getJson<PlayerPageData>(`/api/frontend/pages/player?platform=${info.platform}&media=${info.media}&version=${version}&key=${encodeURIComponent(key)}`)
      .then(async (result) => {
        let urls = sourceList(result, info.media, params)
        if (!urls.length && info.platform === 'kugou' && info.media === 'music') urls = await kugouMusicSources(result)
        setData(result); setSources([...new Set(urls)]); setActive(0); setPlaybackError('')
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '媒体数据加载失败'))
      .finally(() => setLoading(false))
  }, [info.media, info.platform, params, version])

  const title = firstNonEmpty(decodeUrlSafeBase64(params.get('title')), params.get('title'), data.title, musicMeta(data).title)
  const advanced = info.media === 'music' && version === '2' && info.platform !== 'douyin'
  const variant = info.media === 'video' ? (version === '1' ? 'videojs' : version === '2' ? 'plyr' : version === '3' ? 'dplayer' : 'zwplayer') : info.media === 'live' ? (version === '1' ? 'flvjs' : version === '2' ? 'dplayer' : 'zwplayer') : version === '2' ? 'h5' : 'plyr'
  const transport: VideoTransport = info.media === 'live' ? (params.get('type') === 'hls' ? 'hls' : 'flv') : 'native'
  const useCdnProxy = info.platform === 'douyin' && info.media === 'video' && proxyVideoSources(data, params).length > 0

  const platformLabel = info.platform === 'douyin' ? '抖音' : info.platform === 'netease' ? '网易云' : '酷狗'
  const mediaLabel = { video: '视频', live: '直播', music: '音乐', picture: '图片' }[info.media]
  const routeLabel = info.platform === 'douyin' && info.media === 'video'
    ? useCdnProxy ? `CDN 线路 ${params.get('proxyExtra') || '1'}` : '回源线路（原地址）'
    : undefined

  return <main className={`legacy-player-page legacy-player-${variant}`}>
    <Card className="legacy-player-meta" size="small" bordered={false}><Space wrap><Tag color="purple">{platformLabel}</Tag><Tag>{mediaLabel}</Tag><Tag>{variant.toUpperCase()}</Tag>{routeLabel && <Tag color={useCdnProxy ? 'blue' : 'orange'}>{routeLabel}</Tag>}{info.media === 'live' && <Badge status={sources.length ? 'processing' : 'default'} text={sources.length ? '直播线路' : '等待线路'} />}</Space></Card>
    {loading ? <Card className="legacy-player-message" bordered={false}><Spin size="large" tip="正在载入媒体数据"><div className="legacy-search-spin" /></Spin></Card> : error ? <Card className="legacy-player-message" bordered={false}><Result status="error" title="媒体数据加载失败" subTitle={error} extra={<Space><Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>重新加载</Button><Button icon={<HomeOutlined />} href="/">返回首页</Button></Space>} /></Card> : !sources.length ? <Card className="legacy-player-message" bordered={false}><Result status="warning" title={info.media === 'live' ? '直播暂不可用' : '媒体链接不可用'} subTitle={info.media === 'live' ? '直播可能已经结束，或者播放地址已经过期。' : '媒体数据可能已过期，请返回解析页面重新获取。'} extra={<Button type="primary" icon={<HomeOutlined />} href="/douyin">重新解析</Button>} /></Card> : advanced ? <AdvancedMusicPlayer data={data} sources={sources} /> : info.media === 'picture' ? <Card className="legacy-picture" bordered={false} bodyStyle={{ padding: 0 }}><Carousel arrows dots>{sources.map((src) => <div key={src}><Image preview src={src} /></div>)}</Carousel><div className="picture-caption"><PictureOutlined /> {title}</div></Card> : info.media === 'music' ? <Card className="simple-music" bordered={false}><div className="simple-music-icon"><CustomerServiceOutlined /></div><Typography.Title level={2}>{title}</Typography.Title><Typography.Text>{musicMeta(data).artist}</Typography.Text>{sources.length > 1 && <Select value={active} onChange={setActive} options={sources.map((_, index) => ({ value: index, label: `音质 ${index + 1}` }))} />}<audio src={sources[active]} controls autoPlay /></Card> : <Card className="legacy-video-shell" bordered={false} bodyStyle={{ padding: 0 }}>{playbackError && <Alert banner closable type="warning" message={playbackError} onClose={() => setPlaybackError('')} />}{variant === 'zwplayer' ? <OriginalZwPlayer sources={sources} live={info.media === 'live'} transport={transport} useCdnProxy={useCdnProxy} onError={setPlaybackError} /> : <><NativeVideo src={sources[active]} live={info.media === 'live'} transport={transport} useCdnProxy={useCdnProxy} onError={setPlaybackError} /><div className="legacy-video-bar"><Space><Badge status={info.media === 'live' ? 'processing' : 'success'} /><Typography.Text>{info.media === 'live' ? 'LIVE' : variant.toUpperCase()} · {title}</Typography.Text></Space>{sources.length > 1 && <Select value={active} onChange={(value) => { setActive(value); setPlaybackError('') }} options={sources.map((_, index) => ({ value: index, label: `线路 ${index + 1}` }))} />}</div></>}</Card>}
    {sources[active] && !advanced && <Button className="legacy-source-link" type="primary" ghost href={proxiedMediaUrl(sources[active], useCdnProxy)} target="_blank" rel="noreferrer" icon={<LinkOutlined />}>打开源地址</Button>}
  </main>
}
