import flvjs from 'flv.js'

const watchdogInterval = 5_000
const stallTimeout = 15_000

interface ManagedFlvOptions {
  video: HTMLVideoElement
  url: string
  live: boolean
  onReady?: () => void
  onStatus?: (message: string) => void
  onReconnect: () => void
}

export function attachManagedFlv({ video, url, live, onReady, onStatus, onReconnect }: ManagedFlvOptions) {
  const player = flvjs.createPlayer(
    { type: 'flv', isLive: live, url },
    {
      enableStashBuffer: true,
      stashInitialSize: live ? 128 * 1024 : 384 * 1024,
      lazyLoad: !live,
      autoCleanupSourceBuffer: live,
      autoCleanupMaxBackwardDuration: 60,
      autoCleanupMinBackwardDuration: 30,
      fixAudioTimestampGap: true,
    },
  )
  let disposed = false
  let reconnecting = false
  let reconnectTimer: number | undefined
  let watchdog: number | undefined
  let readyReported = false
  let lastPlaybackTime = video.currentTime
  let lastProgressAt = Date.now()

  const markReady = () => {
    lastPlaybackTime = video.currentTime
    lastProgressAt = Date.now()
    if (readyReported) return
    readyReported = true
    onReady?.()
    onStatus?.('')
  }
  const reconnect = (message: string) => {
    if (disposed || reconnecting) return
    reconnecting = true
    onStatus?.(message)
    reconnectTimer = window.setTimeout(onReconnect, 500)
  }
  const handleError = (_type: unknown, detail: unknown) => {
    reconnect(`FLV 播放中断，正在重新连接：${String(detail)}`)
  }

  player.on(flvjs.Events.ERROR, handleError)
  video.addEventListener('loadeddata', markReady)
  video.addEventListener('canplay', markReady)
  video.addEventListener('playing', markReady)
  video.addEventListener('timeupdate', markReady)
  video.removeAttribute('src')
  video.load()
  player.attachMediaElement(video)
  player.load()
  video.muted = live
  void player.play().catch(() => undefined)

  if (live) {
    watchdog = window.setInterval(() => {
      if (disposed || reconnecting || video.paused || video.ended) {
        lastPlaybackTime = video.currentTime
        lastProgressAt = Date.now()
        return
      }
      if (video.currentTime > lastPlaybackTime + 0.1) {
        lastPlaybackTime = video.currentTime
        lastProgressAt = Date.now()
        return
      }
      if (Date.now() - lastProgressAt >= stallTimeout) {
        reconnect('FLV 直播流已停滞，正在重新连接最新画面')
      }
    }, watchdogInterval)
  }

  return () => {
    disposed = true
    window.clearTimeout(reconnectTimer)
    window.clearInterval(watchdog)
    video.removeEventListener('loadeddata', markReady)
    video.removeEventListener('canplay', markReady)
    video.removeEventListener('playing', markReady)
    video.removeEventListener('timeupdate', markReady)
    try {
      player.pause()
      player.unload()
      player.detachMediaElement()
      player.destroy()
    } catch { /* the stream may already be disposed after a media-source failure */ }
  }
}
