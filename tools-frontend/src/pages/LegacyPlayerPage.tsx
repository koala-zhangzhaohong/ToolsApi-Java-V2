import { ArrowLeftOutlined, HomeOutlined, PictureOutlined, ReloadOutlined } from '@ant-design/icons'
import { Alert, Badge, Button, Card, Carousel, Image, Result, Select, Space, Spin, Tag, Typography } from 'antd'
import flvjs from 'flv.js'
import Hls, { ErrorTypes, Events } from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getJson, normalizeCdnProxyUrl } from '../services/http'
import type { JsonRecord, PlayerPageData } from '../types'
import { attachManagedFlv } from '../utils/flvPlayback'
import { decodeUrlSafeBase64, firstNonEmpty } from '../utils/query'
import MusicPlayerPage from './MusicPlayerPage'
import { musicMeta } from './musicMeta'

type LegacyMedia = 'video' | 'live' | 'music' | 'picture'
type VideoTransport = 'native' | 'flv' | 'hls'

interface ZwPlayerInstance {
  paused?: boolean
  pause?: () => void
  destroy: () => void
  createQualitiesMenu?: (qualities: Array<Record<string, unknown>>, includeAuto?: boolean) => void
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
    hideBigPlayButton?: boolean
    muted?: boolean
    disableMutedConfirm?: boolean
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
      stylesheet.href = '/legacy-assets/js/zwplayer/css/zwplayer.css?v=3.3.1'
      document.head.appendChild(stylesheet)
      const script = document.createElement('script')
      script.src = '/legacy-assets/js/zwplayer/zwplayer.js?v=3.3.1'
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

function routeInfo(pathname: string) {
  const platform = /\/DouYin\//i.test(pathname) ? 'douyin' : /\/Netease\//i.test(pathname) ? 'netease' : 'kugou'
  const media: LegacyMedia = /picture/i.test(pathname) ? 'picture' : /music/i.test(pathname) ? 'music' : /live/i.test(pathname) ? 'live' : 'video'
  return { platform, media }
}

function isMusicMvRoute(pathname: string) {
  return /\/tools\/(?:Netease|Kugou)\/pro\/player\/mv(?:\/|$)/i.test(pathname)
}

function isAppleMobileBrowser() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function objectUrls(value: unknown): string[] {
  if (typeof value === 'string' && value) return [value]
  if (Array.isArray(value)) return value.flatMap(objectUrls)
  if (value && typeof value === 'object') return Object.values(value).flatMap(objectUrls)
  return []
}

function isHlsSource(value: string) {
  return /(?:\.m3u8(?:[?#]|$)|[?&]type=hls(?:&|$)|[?&]mime_type=video_hls(?:&|$)|hls)/i.test(value)
}

function liveHlsSources(data: PlayerPageData) {
  const live = data.multiLiveQualityInfo
  return [...new Set([
    ...objectUrls(live?.hls),
    ...objectUrls(live?.HLS),
    ...objectUrls(live?.m3u8),
    ...objectUrls(live).filter(isHlsSource),
  ])]
}

function liveFlvSources(data: PlayerPageData) {
  const live = data.multiLiveQualityInfo
  return [...new Set([
    ...objectUrls(live?.flv),
    ...objectUrls(live?.FLV),
    ...objectUrls(live).filter((value) => !isHlsSource(value)),
  ])]
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
    const mvInfo = data.mvInfo || data.mv_info
    if (Array.isArray(mvInfo)) return mvInfo.flatMap((value) => objectUrls(record(value)?.path))
    return objectUrls(data.path || data.proxyPath)
  }
  const web = record(data.web_player_info || data.webPlayerInfo)
  const item = record(data.item_info || data.itemInfo)
  const itemData = Array.isArray(item?.data) ? item.data : []
  return [...objectUrls(data.path || data.proxyPath), ...objectUrls(web?.player_url_list || web?.playerUrlList), ...itemData.flatMap((value) => {
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

function proxiedMediaUrl(src: string, bypassCdn: boolean) {
  const normalized = normalizeCdnProxyUrl(src)
  try {
    const url = new URL(normalized, window.location.origin)
    const key = url.searchParams.get('key')
    // "Origin" selects the provider's original quality/source. It must still go
    // through our media endpoint because provider CDNs require relay headers and
    // do not consistently allow direct browser playback/CORS.
    if (key && url.pathname === '/short') {
      const origin = bypassCdn ? '&origin=true' : ''
      return `/api/frontend/pages/media?key=${encodeURIComponent(key)}${origin}`
    }
    if (url.origin === window.location.origin && url.pathname === '/api/frontend/pages/media') return `${url.pathname}${url.search}`
    if (bypassCdn) return normalized
    return normalized
  } catch {
    return normalized
  }
}

function playerMediaUrl(src: string, transport: VideoTransport, bypassCdn: boolean) {
  const proxied = proxiedMediaUrl(src, bypassCdn)
  if (transport === 'native') return proxied
  try {
    const url = new URL(proxied, window.location.origin)
    if (url.origin !== window.location.origin) return url.toString()
    url.searchParams.set('mime_type', `video_${transport}`)
    return `${url.pathname}${url.search}`
  } catch {
    return proxied
  }
}

function qualityName(index: number, total: number) {
  const fourLevels = ['原画', '超清', '高清', '标清']
  const twoLevels = ['高清', '标清']
  return (total >= 4 ? fourLevels[index] : total === 2 ? twoLevels[index] : undefined) || `线路 ${index + 1}`
}

const liveWatchdogInterval = 5_000
const liveStallTimeout = 30_000

function bufferedAhead(video: HTMLVideoElement) {
  for (let index = 0; index < video.buffered.length; index += 1) {
    if (video.buffered.start(index) <= video.currentTime + 0.1 && video.buffered.end(index) >= video.currentTime) {
      return video.buffered.end(index) - video.currentTime
    }
  }
  return 0
}

function attachManagedHls(
  video: HTMLVideoElement,
  playbackUrl: string,
  live: boolean,
  onError: (message: string) => void,
  onReady: () => void,
  onRecreate: () => void,
) {
  const stream = new Hls({
    lowLatencyMode: false,
    liveDurationInfinity: live,
    liveSyncDurationCount: 5,
    liveMaxLatencyDurationCount: 12,
    backBufferLength: live ? 45 : 90,
    maxBufferLength: live ? 60 : 60,
    maxMaxBufferLength: live ? 90 : 600,
    maxBufferHole: 0.5,
    manifestLoadingMaxRetry: 6,
    manifestLoadingRetryDelay: 1_000,
    manifestLoadingMaxRetryTimeout: 12_000,
    levelLoadingMaxRetry: 6,
    levelLoadingRetryDelay: 1_000,
    levelLoadingMaxRetryTimeout: 12_000,
    fragLoadingMaxRetry: 6,
    fragLoadingRetryDelay: 1_000,
    fragLoadingMaxRetryTimeout: 12_000,
  })
  let disposed = false
  let watchdog: number | undefined
  let lastPlaybackTime = video.currentTime
  let lastProgressAt = Date.now()

  const resumeLive = () => {
    if (disposed) return
    const liveEdge = stream.liveSyncPosition
    if (live && typeof liveEdge === 'number' && Number.isFinite(liveEdge) && liveEdge > video.currentTime + 15) {
      video.currentTime = liveEdge
    }
    stream.startLoad(-1)
    void video.play().catch(() => undefined)
  }

  stream.on(Events.ERROR, (_, event) => {
    if (!event.fatal) return
    if (event.type === ErrorTypes.NETWORK_ERROR) {
      onError('直播网络波动，正在自动恢复')
      resumeLive()
    } else if (event.type === ErrorTypes.MEDIA_ERROR) {
      onError('直播解码中断，正在自动恢复')
      stream.recoverMediaError()
    } else {
      onError(`HLS 播放失败：${event.details}`)
      window.setTimeout(onRecreate, 500)
    }
  })
  stream.on(Events.FRAG_BUFFERED, () => {
    onReady()
    onError('')
  })
  stream.on(Events.LEVEL_UPDATED, () => onError(''))
  stream.loadSource(playbackUrl)
  stream.attachMedia(video)
  video.muted = live
  void video.play().catch(() => undefined)

  if (live) {
    watchdog = window.setInterval(() => {
      if (disposed || video.paused || video.ended) {
        lastPlaybackTime = video.currentTime
        lastProgressAt = Date.now()
        return
      }
      if (video.currentTime > lastPlaybackTime + 0.1) {
        lastPlaybackTime = video.currentTime
        lastProgressAt = Date.now()
        return
      }
      if (bufferedAhead(video) > 0.75) {
        void video.play().catch(() => undefined)
        return
      }
      if (Date.now() - lastProgressAt < liveStallTimeout) return
      onError('直播流已停滞，正在追赶最新画面')
      resumeLive()
      lastPlaybackTime = video.currentTime
      lastProgressAt = Date.now()
    }, liveWatchdogInterval)
  }

  return () => {
    disposed = true
    window.clearInterval(watchdog)
    stream.destroy()
  }
}

function OriginalZwPlayer({ sources, live, transport, bypassCdn, onError }: { sources: string[]; live: boolean; transport: VideoTransport; bypassCdn: boolean; onError: (message: string) => void }) {
  const elementId = useRef(`zw-player-${Math.random().toString(36).slice(2)}`)
  const [playerLoading, setPlayerLoading] = useState(true)
  const [showMutedHint, setShowMutedHint] = useState(false)
  useEffect(() => {
    const playerElementId = elementId.current
    let disposed = false
    let player: ZwPlayerInstance | undefined
    let streamCleanup: (() => void) | undefined
    let streamTimer: number | undefined
    let activeSourceIndex = sources.length > 1 ? 1 : 0
    let removeQualityListener: (() => void) | undefined
    let removeToastObserver: (() => void) | undefined
    let removePlaybackStateListeners: (() => void) | undefined
    let firstFramePending = true
    let firstFrameRendered = false
    let mediaBuffering = true
    const syncControlbarPlayButton = (video: HTMLVideoElement) => {
      const playerElement = document.getElementById(playerElementId)
      const playing = !video.paused && !video.ended
      playerElement?.classList.toggle('zwp-playing', playing)
      playerElement?.classList.toggle('zwp-pause', !playing)
      const playButton = playerElement?.querySelector<HTMLElement>('.zwp-playbtn')
      playButton?.setAttribute('data-action', playing ? 'pause' : 'play')
      playButton?.setAttribute('aria-label', playing ? '暂停' : '播放')
      playButton?.setAttribute('title', playing ? '暂停' : '播放')
    }
    const syncBigPlayButton = () => {
      const playerElement = document.getElementById(playerElementId)
      const video = playerElement?.querySelector('video')
      const shouldShow = Boolean(video?.paused && !firstFramePending && !mediaBuffering)
      playerElement?.querySelectorAll<HTMLElement>('.zwp__overlay-play, .zwp__overlay-button').forEach((element) => {
        element.style.setProperty('display', shouldShow ? 'flex' : 'none', 'important')
      })
    }
    const installPlaybackStateListeners = () => {
      const video = document.getElementById(playerElementId)?.querySelector('video')
      if (!video) return
      const setBuffering = () => {
        mediaBuffering = true
        syncBigPlayButton()
      }
      const setReady = () => {
        mediaBuffering = false
        syncBigPlayButton()
      }
      const hideWhilePlaying = () => {
        mediaBuffering = false
        syncControlbarPlayButton(video)
        syncBigPlayButton()
      }
      const showWhenPaused = () => {
        syncControlbarPlayButton(video)
        syncBigPlayButton()
      }
      const bufferingEvents = ['loadstart', 'waiting', 'stalled', 'seeking'] as const
      const readyEvents = ['loadeddata', 'canplay', 'canplaythrough', 'seeked'] as const
      const playingEvents = ['play', 'playing', 'timeupdate'] as const
      bufferingEvents.forEach((event) => video.addEventListener(event, setBuffering))
      readyEvents.forEach((event) => video.addEventListener(event, setReady))
      playingEvents.forEach((event) => video.addEventListener(event, hideWhilePlaying))
      video.addEventListener('pause', showWhenPaused)
      video.addEventListener('ended', showWhenPaused)
      syncControlbarPlayButton(video)
      syncBigPlayButton()
      removePlaybackStateListeners = () => {
        bufferingEvents.forEach((event) => video.removeEventListener(event, setBuffering))
        readyEvents.forEach((event) => video.removeEventListener(event, setReady))
        playingEvents.forEach((event) => video.removeEventListener(event, hideWhilePlaying))
        video.removeEventListener('pause', showWhenPaused)
        video.removeEventListener('ended', showWhenPaused)
      }
    }
    const beginFirstFrameLoading = () => {
      if (firstFrameRendered) return
      firstFramePending = true
      mediaBuffering = true
      setPlayerLoading(true)
      syncBigPlayButton()
    }
    const finishFirstFrameLoading = () => {
      if (!firstFramePending) return
      firstFramePending = false
      firstFrameRendered = true
      mediaBuffering = false
      setPlayerLoading(false)
      syncBigPlayButton()
      const video = document.getElementById(playerElementId)?.querySelector('video')
      if (live && video?.muted) setShowMutedHint(true)
    }
    const scheduleAttachStream = (sourceIndex = activeSourceIndex, delay = 0) => {
      window.clearTimeout(streamTimer)
      streamTimer = window.setTimeout(() => {
        if (disposed) return
        attachStream(sourceIndex)
      }, delay)
    }
    const attachStream = (sourceIndex = activeSourceIndex) => {
      activeSourceIndex = sourceIndex
      streamCleanup?.()
      const video = document.getElementById(playerElementId)?.querySelector('video')
      if (!video || transport === 'native') return
      beginFirstFrameLoading()
      const selectedSource = sources[activeSourceIndex]
      const playbackUrl = playerMediaUrl(selectedSource, transport, bypassCdn)
      if (transport === 'flv' && flvjs.isSupported()) {
        streamCleanup = attachManagedFlv({
          video,
          url: playbackUrl,
          live,
          onReady: finishFirstFrameLoading,
          onStatus: onError,
          onReconnect: () => {
            scheduleAttachStream(activeSourceIndex, 500)
          },
        })
      } else if (transport === 'hls' && Hls.isSupported()) {
        video.removeAttribute('src')
        video.load()
        streamCleanup = attachManagedHls(video, playbackUrl, live, onError, finishFirstFrameLoading, () => {
          scheduleAttachStream(activeSourceIndex, 500)
        })
      }
    }
    loadZwPlayer().then((ZWPlayer) => {
      if (disposed) return
      const managedStream = transport !== 'native'
      let playerReady = false
      beginFirstFrameLoading()
      player = new ZWPlayer({
        playerElm: playerElementId,
        url: sources.map((source, index) => ({
          name: qualityName(index, sources.length),
          url: playerMediaUrl(source, transport, bypassCdn),
          type: transport === 'native' ? undefined : 'mp4',
          default: index === (sources.length > 1 ? 1 : 0),
        })),
        infoButton: true,
        optionButton: true,
        snapshotButton: true,
        controlbar: true,
        autoplay: !managedStream,
        isLive: live,
        hideBigPlayButton: false,
        muted: live,
        disableMutedConfirm: true,
        onready: () => {
          playerReady = true
          onError('')
          installPlaybackStateListeners()
          // ZWPlayer may defer the quality control until a playback state event.
          // Build it explicitly so the selector is available on first render.
          player?.createQualitiesMenu?.(sources.map((source, index) => ({
            name: qualityName(index, sources.length),
            qualityIndex: index,
            url: playerMediaUrl(source, transport, bypassCdn),
          })), false)
          if (managedStream) scheduleAttachStream(activeSourceIndex)
        },
        onmediaevent: (event) => {
          if (['loadeddata', 'canplay', 'playing', 'timeupdate'].includes(event.type)) finishFirstFrameLoading()
          if (firstFrameRendered && ['pause', 'ended'].includes(event.type)) setPlayerLoading(false)
          if (event.type === 'error' && !managedStream) {
            setPlayerLoading(false)
            onError('媒体地址不可播放，链接可能已经过期')
          }
        },
      })
      const playerElement = document.getElementById(playerElementId)
      const removeInternalConfirmToasts = () => {
        playerElement?.querySelectorAll('.zwp-toast.zwp-confirm').forEach((toast) => toast.remove())
      }
      const toastObserver = new MutationObserver(removeInternalConfirmToasts)
      if (playerElement) {
        removeInternalConfirmToasts()
        toastObserver.observe(playerElement, { childList: true, subtree: true })
      }
      removeToastObserver = () => toastObserver.disconnect()
      const handleQualityClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null
        if (target?.closest('.zwp-playbtn')) {
          const video = playerElement?.querySelector('video')
          if (!video) return
          event.preventDefault()
          event.stopPropagation()
          if (video.paused || video.ended) void video.play().catch(() => undefined)
          else video.pause()
          return
        }
        const label = target?.closest('li,button,div')?.textContent?.trim()
        const sourceIndex = sources.findIndex((_, index) => qualityName(index, sources.length) === label)
        if (!managedStream || sourceIndex < 0 || sourceIndex === activeSourceIndex) return
        scheduleAttachStream(sourceIndex, 300)
      }
      playerElement?.addEventListener('click', handleQualityClick, true)
      removeQualityListener = () => playerElement?.removeEventListener('click', handleQualityClick, true)
      if (managedStream && !playerReady) scheduleAttachStream(activeSourceIndex, 500)
    }).catch((reason) => {
      setPlayerLoading(false)
      onError(reason instanceof Error ? reason.message : '播放器加载失败')
    })
    return () => {
      disposed = true
      window.clearTimeout(streamTimer)
      streamCleanup?.()
      removeQualityListener?.()
      removeToastObserver?.()
      removePlaybackStateListeners?.()
      try {
        player?.pause?.()
        player?.destroy()
      } catch { /* player may already be disposed internally */ }
      document.getElementById(playerElementId)?.replaceChildren()
    }
  }, [bypassCdn, live, onError, sources, transport])
  const enableSound = () => {
    const video = document.getElementById(elementId.current)?.querySelector('video')
    if (video) {
      video.muted = false
      if (video.volume === 0) video.volume = 1
      void video.play().catch(() => undefined)
    }
    setShowMutedHint(false)
  }
  return <div className="legacy-original-player-stage">
    <div id={elementId.current} className="zw-video-player-custom legacy-original-player" />
    <div className={`zw-player-loading ${playerLoading ? 'is-visible' : ''}`} role="status" aria-live="polite" aria-label="播放器加载中">
      <span className="zw-player-loading-spinner" />
      <span>正在加载画面</span>
    </div>
    {showMutedHint && !playerLoading && <div className="zw-player-muted-hint" role="status">
      <span>因浏览器限制，已静音播放</span>
      <button type="button" onClick={enableSound}>打开声音</button>
      <button type="button" className="zw-player-muted-close" aria-label="关闭静音提示" onClick={() => setShowMutedHint(false)}>×</button>
    </div>}
  </div>
}

function NativeVideo({ src, live, transport, bypassCdn, onError }: { src: string; live: boolean; transport: VideoTransport; bypassCdn: boolean; onError: (message: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video || !src) return
    const playbackUrl = playerMediaUrl(src, transport, bypassCdn)
    const useHls = transport === 'hls' || /\.m3u8(?:\?|$)/i.test(src) || /mime_type=video_hls/i.test(playbackUrl)
    const useFlv = transport === 'flv' || /\.flv(?:\?|$)/i.test(src) || /mime_type=video_flv/i.test(playbackUrl)
    if (useHls && Hls.isSupported()) {
      let cleanup: () => void = () => undefined
      const recreate = () => {
        cleanup()
        cleanup = attachManagedHls(video, playbackUrl, live, onError, () => onError(''), recreate)
      }
      recreate()
      return () => cleanup()
    }
    if (useHls && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl
      video.load()
      return
    }
    if (useFlv && flvjs.isSupported()) {
      let cleanup: () => void = () => undefined
      const recreate = () => {
        cleanup()
        cleanup = attachManagedFlv({ video, url: playbackUrl, live, onReady: () => onError(''), onStatus: onError, onReconnect: recreate })
      }
      recreate()
      return () => cleanup()
    }
    video.src = playbackUrl
    video.load()
  }, [bypassCdn, src, live, transport, onError])
  return <video ref={ref} controls playsInline webkit-playsinline="true" x5-playsinline="true" autoPlay={live} muted={live} preload="metadata" className="legacy-media-video" onCanPlay={() => onError('')} onError={() => onError('媒体地址不可播放，链接可能已经过期')} />
}

export default function LegacyPlayerPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const embedded = params.get('embed') === '1'
  const info = useMemo(() => routeInfo(location.pathname), [location.pathname])
  const musicMvRoute = useMemo(() => isMusicMvRoute(location.pathname), [location.pathname])
  const appleMobile = useMemo(isAppleMobileBrowser, [])
  const defaultVersion = info.platform === 'douyin' && info.media === 'video' && /\/short\/?$/i.test(location.pathname)
    ? '4'
    : musicMvRoute
      ? '3'
      : info.platform === 'douyin' && info.media === 'live' && /\/short\/?$/i.test(location.pathname)
        ? appleMobile ? '2' : '3'
        : '2'
  const version = params.get('version') || defaultVersion
  const direct = firstNonEmpty(decodeUrlSafeBase64(params.get('path')), params.get('path'), params.get('src'))
  const [data, setData] = useState<PlayerPageData>({})
  const [sources, setSources] = useState<string[]>(direct ? [direct] : [])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(Boolean(params.get('key')))
  const [error, setError] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const flvPlayable = useMemo(() => !appleMobile && flvjs.isSupported(), [appleMobile])
  const requestedLiveTransport: VideoTransport = params.get('type') === 'hls' ? 'hls' : 'flv'
  const transport: VideoTransport = info.media === 'live'
    ? requestedLiveTransport === 'hls' || !flvPlayable ? 'hls' : 'flv'
    : 'native'

  useEffect(() => {
    if (!embedded) return
    const htmlOverflow = document.documentElement.style.overflow
    const bodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = htmlOverflow
      document.body.style.overflow = bodyOverflow
    }
  }, [embedded])

  useEffect(() => {
    const key = params.get('key')
    if (!key) return
    setLoading(true); setError('')
    getJson<PlayerPageData>(`/api/frontend/pages/player?platform=${info.platform}&media=${info.media}&version=${version}&key=${encodeURIComponent(key)}`)
      .then(async (result) => {
        if (info.media === 'live') {
          const flvUrls = liveFlvSources(result)
          const hlsUrls = liveHlsSources(result)
          const shouldUseHls = requestedLiveTransport === 'hls' || !flvPlayable
          const urls = shouldUseHls ? hlsUrls : (flvUrls.length ? flvUrls : hlsUrls)
          setData(result); setSources([...new Set(urls)]); setActive(0)
          setPlaybackError(!flvPlayable && requestedLiveTransport === 'flv' && hlsUrls.length
            ? '当前浏览器不支持 FLV，已自动切换到 HLS 兼容线路'
            : !urls.length && !flvPlayable && flvUrls.length
              ? '当前浏览器不支持 FLV，且该直播暂未提供 HLS 线路'
              : '')
          return
        }
        let urls = sourceList(result, info.media, params)
        if (!urls.length && info.platform === 'kugou' && info.media === 'music') urls = await kugouMusicSources(result)
        setData(result); setSources([...new Set(urls)]); setActive(0); setPlaybackError('')
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : '媒体数据加载失败'))
      .finally(() => setLoading(false))
  }, [flvPlayable, info.media, info.platform, params, requestedLiveTransport, version])

  const title = firstNonEmpty(decodeUrlSafeBase64(params.get('title')), params.get('title'), data.title, musicMeta(data).title)
  const variant = info.media === 'video'
    ? musicMvRoute
      ? version === '3' ? 'zwplayer' : version === '1' ? 'videojs' : 'plyr'
      : version === '1' ? 'videojs' : version === '2' ? 'plyr' : version === '3' ? 'dplayer' : 'zwplayer'
    : info.media === 'live' ? (version === '1' ? 'flvjs' : version === '2' ? 'dplayer' : 'zwplayer') : version === '2' ? 'h5' : 'plyr'
  const useCdnProxy = info.platform === 'douyin' && info.media === 'video' && proxyVideoSources(data, params).length > 0
  // `origin=true` selects the provider's original-quality source; it must not
  // bypass the CDN relay because Douyin origin hosts reject direct browser access.
  const bypassCdn = info.media === 'live'
  const musicSources = useMemo(() => sources.map((source) => proxiedMediaUrl(source, bypassCdn)), [bypassCdn, sources])
  const openPicturePreview = (index: number) => {
    if (!embedded) return
    window.parent.postMessage({ type: 'tools-api:picture-preview', sources, index }, window.location.origin)
  }

  const platformLabel = info.platform === 'douyin' ? '抖音' : info.platform === 'netease' ? '网易云' : '酷狗'
  const mediaLabel = { video: '视频', live: '直播', music: '音乐', picture: '图片' }[info.media]
  const routeLabel = info.platform === 'douyin' && info.media === 'video'
    ? useCdnProxy ? `CDN 线路 ${params.get('proxyExtra') || '1'}` : '回源线路（原地址）'
    : undefined

  return <main className={`legacy-player-page legacy-player-${variant} ${embedded ? 'legacy-player-embedded' : ''}`}>
    {!embedded && musicMvRoute && <Button type="text" className="legacy-back-button" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>}
    {!embedded && <Card className="legacy-player-meta" size="small" bordered={false}><Space wrap><Tag color="purple">{platformLabel}</Tag><Tag>{mediaLabel}</Tag><Tag>{variant.toUpperCase()}</Tag>{routeLabel && <Tag color={useCdnProxy ? 'blue' : 'orange'}>{routeLabel}</Tag>}{info.media === 'live' && <Badge status={sources.length ? 'processing' : 'default'} text={sources.length ? '直播线路' : '等待线路'} />}</Space></Card>}
    {loading ? <Card className="legacy-player-message" bordered={false}><Spin size="large" tip="正在载入媒体数据"><div className="legacy-search-spin" /></Spin></Card> : error ? <Card className="legacy-player-message" bordered={false}><Result status="error" title="媒体数据加载失败" subTitle={error} extra={<Space><Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>重新加载</Button><Button type="text" className="legacy-back-button legacy-back-button-result" icon={<ArrowLeftOutlined />} href="/">返回首页</Button></Space>} /></Card> : !sources.length ? <Card className="legacy-player-message" bordered={false}><Result status="warning" title={info.media === 'live' ? '直播暂不可用' : '媒体链接不可用'} subTitle={info.media === 'live' ? '直播可能已经结束，或者播放地址已经过期。' : '媒体数据可能已过期，请返回解析页面重新获取。'} extra={<Button type="primary" icon={<HomeOutlined />} href="/douyin">重新解析</Button>} /></Card> : info.media === 'music' ? <MusicPlayerPage data={data} sources={musicSources} compact={embedded} /> : info.media === 'picture' ? <Card className="legacy-picture" bordered={false} bodyStyle={{ padding: 0 }}><Carousel arrows dots>{sources.map((src, index) => <div key={src}>{embedded ? <Image preview={false} src={src} onClick={() => openPicturePreview(index)} /> : <Image preview src={src} />}</div>)}</Carousel><div className="picture-caption"><PictureOutlined /> {title}</div></Card> : <Card className="legacy-video-shell" bordered={false} bodyStyle={{ padding: 0 }}>{playbackError && <Alert banner closable type="warning" message={playbackError} onClose={() => setPlaybackError('')} />}{variant === 'zwplayer' ? <OriginalZwPlayer sources={sources} live={info.media === 'live'} transport={transport} bypassCdn={bypassCdn} onError={setPlaybackError} /> : <><NativeVideo src={sources[active]} live={info.media === 'live'} transport={transport} bypassCdn={bypassCdn} onError={setPlaybackError} /><div className="legacy-video-bar"><Space><Badge status={info.media === 'live' ? 'processing' : 'success'} /><Typography.Text>{info.media === 'live' ? 'LIVE' : variant.toUpperCase()} · {title}</Typography.Text></Space>{sources.length > 1 && <Select value={active} onChange={(value) => { setActive(value); setPlaybackError('') }} options={sources.map((_, index) => ({ value: index, label: `线路 ${index + 1}` }))} />}</div></>}</Card>}
  </main>
}
