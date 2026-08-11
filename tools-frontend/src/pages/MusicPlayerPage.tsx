import {
  CustomerServiceOutlined,
  DownloadOutlined,
  FileTextOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
  ShareAltOutlined,
  StepBackwardOutlined,
  StepForwardOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import { App, Button, Card, Col, Empty, Row, Select, Slider, Space, Tag, Tooltip, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlayerPageData } from '../types'
import { musicMeta } from './musicMeta'

type LyricLine = { time: number; text: string; index: number }

function parseTime(value: string) {
  const [minute, second] = value.split(':').map(Number)
  return Number.isFinite(minute) && Number.isFinite(second) ? minute * 60 + second : null
}

function parseLyrics(raw?: string): LyricLine[] {
  if (!raw?.trim()) return []
  const rows: LyricLine[] = []
  const plainLines: string[] = []
  let offset = 0
  raw.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line) => {
    const offsetMatch = line.match(/^\[offset:([-+]?\d+)\]/i)
    if (offsetMatch) offset = Number(offsetMatch[1]) / 1000
    const tags = [...line.matchAll(/\[(\d{1,3}:\d{2}(?:\.\d{1,3})?)\]/g)]
    const lyricText = line.replace(/\[[^\]]*\]/g, '').trim()
    if (!tags.length) {
      if (lyricText && !/^\[(?:ti|ar|al|by|re|ve|offset):/i.test(line.trim())) plainLines.push(lyricText)
      return
    }
    if (!lyricText) return
    tags.forEach((tag) => {
      const time = parseTime(tag[1])
      if (time !== null) rows.push({ time: Math.max(0, time + offset), text: lyricText, index: 0 })
    })
  })
  if (!rows.length) return plainLines.map((text, index) => ({ time: 0, text, index }))
  rows.sort((a, b) => a.time - b.time)
  return rows.map((line, index) => ({ ...line, index }))
}

function activeLyricIndex(lines: LyricLine[], time: number) {
  let low = 0
  let high = lines.length - 1
  let result = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (lines[middle].time <= time) {
      result = middle
      low = middle + 1
    } else high = middle - 1
  }
  return result
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '00:00'
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // HTTP deployments may not expose the Clipboard API.
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  return copied
}

function sourceLabel(index: number, total: number, labels?: string[]) {
  if (labels?.[index]) return labels[index]
  const names = total >= 4 ? ['原画', '超清', '高清', '标清'] : total === 2 ? ['高音质', '标准'] : []
  return names[index] || `线路 ${index + 1}`
}

function waveformHeights(seed: string, count = 96) {
  let state = [...seed].reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0
  return Array.from({ length: count }, (_, index) => {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) + index) >>> 0
    const envelope = .55 + Math.sin((index / count) * Math.PI) * .45
    return Math.round((20 + (state % 75)) * envelope)
  })
}

function Waveform({ title, currentTime, duration, playing, onSeek }: { title: string; currentTime: number; duration: number; playing: boolean; onSeek: (time: number) => void }) {
  const heights = useMemo(() => waveformHeights(title), [title])
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0
  const jump = (clientX: number, element: HTMLDivElement) => {
    if (!duration) return
    const bounds = element.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)) * duration)
  }
  return (
    <div
      className={`music-waveform ${playing ? 'is-playing' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="播放波形"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onClick={(event) => jump(event.clientX, event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        onSeek(Math.max(0, Math.min(duration, currentTime + (event.key === 'ArrowRight' ? 5 : -5))))
      }}
    >
      {heights.map((height, index) => <span
        key={index}
        className={(index + 1) / heights.length <= progress ? 'active' : ''}
        style={{ height: `${height}%`, animationDelay: `${-(index % 17) * 67}ms`, animationDuration: `${520 + (index * 47) % 680}ms` }}
      />)}
    </div>
  )
}

interface MusicPlayerPageProps {
  data: PlayerPageData
  sources: string[]
  sourceLabels?: string[]
  compact?: boolean
  qualityOptions?: Array<{ value: string; label: string }>
  initialQuality?: string
  onQualityChange?: (quality: string) => Promise<string>
}

export default function MusicPlayerPage({ data, sources, sourceLabels, compact = false, qualityOptions, initialQuality, onQualityChange }: MusicPlayerPageProps) {
  const { message } = App.useApp()
  const meta = useMemo(() => musicMeta(data), [data])
  const lines = useMemo(() => parseLyrics(meta.lyric), [meta.lyric])
  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricBoxRef = useRef<HTMLDivElement>(null)
  const resumeAfterSourceChange = useRef(false)
  const resumeTimeAfterSourceChange = useRef(0)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [speed, setSpeed] = useState(1)
  const [lyricIndex, setLyricIndex] = useState(-1)
  const [showLyrics, setShowLyrics] = useState(true)
  const [playbackError, setPlaybackError] = useState('')
  const [quality, setQuality] = useState(initialQuality || '')
  const [qualitySource, setQualitySource] = useState('')
  const [qualityLoading, setQualityLoading] = useState(false)
  const hasQualitySelector = Boolean(qualityOptions?.length && initialQuality && onQualityChange)
  const src = qualitySource || sources[sourceIndex] || sources[0]
  const downloadSrc = useMemo(() => {
    if (!src) return ''
    try {
      const parsed = new URL(src, window.location.origin)
      const key = parsed.searchParams.get('key')
      if (parsed.pathname === '/api/frontend/pages/media' && key) {
        return `/api/frontend/pages/download?key=${encodeURIComponent(key)}`
      }
    } catch {
      return src
    }
    return src
  }, [src])

  useEffect(() => {
    setSourceIndex(0)
    setCurrentTime(0)
    setDuration(0)
    setLyricIndex(-1)
    setPlaybackError('')
    setQuality(initialQuality || '')
    setQualitySource('')
  }, [sources])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = volume / 100
      audio.playbackRate = speed
    }
  }, [speed, volume])

  useEffect(() => {
    if (lyricIndex < 0) return
    lyricBoxRef.current?.querySelector(`[data-lyric-index="${lyricIndex}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [lyricIndex])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play().catch(() => {
      audio.pause()
      setPlaying(false)
      setPlaybackError('媒体地址不可播放，链接可能已过期')
    })
    else audio.pause()
  }

  useEffect(() => {
    const handleSpacePlayback = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))) return
      const audio = audioRef.current
      if (!audio || !src) return
      event.preventDefault()
      if (audio.paused) void audio.play().catch(() => {
        audio.pause()
        setPlaying(false)
        setPlaybackError('媒体地址不可播放，链接可能已过期')
      })
      else audio.pause()
    }
    window.addEventListener('keydown', handleSpacePlayback)
    return () => window.removeEventListener('keydown', handleSpacePlayback)
  }, [src])

  const changeSource = (next: number) => {
    const audio = audioRef.current
    const shouldResume = Boolean(audio && !audio.paused)
    resumeAfterSourceChange.current = shouldResume
    resumeTimeAfterSourceChange.current = audio?.currentTime || 0
    if (shouldResume) audio?.pause()
    setPlaying(false)
    setCurrentTime(resumeTimeAfterSourceChange.current)
    setDuration(0)
    setLyricIndex(-1)
    setSourceIndex(next)
    setPlaybackError('')
  }

  const changeQuality = async (next: string) => {
    if (!onQualityChange || next === quality || qualityLoading) return
    const audio = audioRef.current
    const shouldResume = Boolean(audio && !audio.paused)
    const resumeTime = audio?.currentTime || 0
    if (shouldResume) audio?.pause()
    setPlaying(false)
    setQualityLoading(true)
    setPlaybackError('')
    try {
      const nextSource = await onQualityChange(next)
      resumeAfterSourceChange.current = shouldResume
      resumeTimeAfterSourceChange.current = resumeTime
      setCurrentTime(resumeTime)
      setDuration(0)
      setLyricIndex(-1)
      setQuality(next)
      setQualitySource(nextSource)
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : '音质切换失败')
      if (shouldResume && audio) void audio.play().catch(() => {
        audio.pause()
        setPlaying(false)
      })
    } finally {
      setQualityLoading(false)
    }
  }

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrentTime(value)
    setLyricIndex(activeLyricIndex(lines, value))
  }

  const copyShareLink = async () => {
    try {
      if (!await copyText(window.location.href)) throw new Error('copy failed')
      message.success('分享链接已复制')
    } catch {
      message.warning('分享链接复制失败')
    }
  }

  return (
    <main className={`music-player-page ${compact ? 'music-player-compact' : ''}`}>
      <Card className="music-player-shell" bordered={false}>
        <div className="music-player-background" style={meta.cover ? { backgroundImage: `linear-gradient(120deg, rgba(10,12,22,.95), rgba(20,20,42,.88)), url(${meta.cover})` } : undefined} />
        <Row gutter={[32, 32]} className="music-player-grid">
          {!compact && <Col xs={24} md={9} className="music-player-art-column">
            <div className={`music-player-disc ${playing ? 'is-playing' : ''}`}>
              {meta.cover ? <img src={meta.cover} alt={`${meta.title}专辑封面`} /> : <CustomerServiceOutlined />}
            </div>
            <Tag color="purple">{meta.album || '音乐播放器'}</Tag>
            <Typography.Title level={2}>{meta.title}</Typography.Title>
            <Typography.Text className="music-player-artist">{meta.artist}</Typography.Text>
            <div className="music-player-art-actions">
              <Button icon={<FileTextOutlined />} onClick={() => setShowLyrics((value) => !value)}>{showLyrics ? '隐藏歌词' : '显示歌词'}</Button>
            </div>
          </Col>}
          <Col xs={24} md={compact ? 24 : 15} className="music-player-main-column">
            {compact ? <Typography.Title level={2} className="music-player-compact-title">{meta.title}</Typography.Title> : <>
              <div className="music-player-topline"><Typography.Text>NOW PLAYING</Typography.Text><span>{hasQualitySelector ? qualityOptions?.findIndex((option) => option.value === quality)! + 1 : sourceIndex + 1}/{Math.max(1, hasQualitySelector ? qualityOptions?.length || 0 : sources.length)} 音质</span></div>
              <div className="music-player-current-lyric">{lines[lyricIndex]?.text || (lines.length ? '准备播放' : '暂无歌词')}</div>
            </>}
            {!compact && showLyrics && <div className="music-lyrics-panel" ref={lyricBoxRef} aria-label="歌词">
              {lines.length ? lines.map((line) => <button key={`${line.time}-${line.index}`} data-lyric-index={line.index} className={line.index === lyricIndex ? 'active' : ''} onClick={() => seek(line.time)}>{line.text}</button>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无歌词" />}
            </div>}
            {playbackError && <Typography.Text type="danger" className="music-player-error">{playbackError}</Typography.Text>}
            <Waveform title={`${meta.title}-${meta.artist}`} currentTime={currentTime} duration={duration} playing={playing} onSeek={seek} />
            <Slider className="music-progress-slider" min={0} max={duration || 1} value={Math.min(currentTime, duration || 1)} onChange={seek} tooltip={{ formatter: (value) => formatTime(Number(value)) }} />
            <div className="music-time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
            <audio
              key={src}
              ref={audioRef}
              src={src}
              preload="metadata"
              onCanPlay={(event) => {
                const resumeTime = resumeTimeAfterSourceChange.current
                if (resumeTime > 0 && Number.isFinite(resumeTime)) {
                  event.currentTarget.currentTime = resumeTime
                }
                const shouldResume = resumeAfterSourceChange.current
                resumeAfterSourceChange.current = false
                resumeTimeAfterSourceChange.current = 0
                if (!shouldResume) return
                void event.currentTarget.play().catch(() => {
                  event.currentTarget.pause()
                  setPlaying(false)
                  setPlaybackError('')
                })
              }}
              onPlay={() => { setPlaying(true); setPlaybackError('') }}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onLoadedMetadata={(event) => {
                setPlaybackError('')
                setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
                if (resumeTimeAfterSourceChange.current > 0) {
                  event.currentTarget.currentTime = Math.min(resumeTimeAfterSourceChange.current, event.currentTarget.duration || resumeTimeAfterSourceChange.current)
                }
              }}
              onTimeUpdate={(event) => {
                const time = event.currentTarget.currentTime
                setCurrentTime(time)
                setLyricIndex(activeLyricIndex(lines, time))
              }}
              onError={(event) => {
                if (event.currentTarget.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
                  setPlaybackError('媒体地址不可播放，链接可能已过期')
                }
              }}
            />
            <div className="music-player-controls">
              <div className="music-volume-control">
                <Tooltip title="音量"><SoundOutlined /></Tooltip>
                <Slider className="music-volume-slider" min={0} max={100} value={volume} onChange={setVolume} />
              </div>
              <Space className="music-transport-controls" size={6}>
                <Tooltip title="上一音质"><Button type="text" aria-label="上一音质" icon={<StepBackwardOutlined />} onClick={() => hasQualitySelector ? void changeQuality(qualityOptions![Math.max(0, qualityOptions!.findIndex((option) => option.value === quality) - 1)].value) : changeSource(Math.max(0, sourceIndex - 1))} disabled={qualityLoading || (hasQualitySelector ? qualityOptions!.findIndex((option) => option.value === quality) <= 0 : sourceIndex === 0)} /></Tooltip>
                <Button type="primary" aria-label={playing ? '暂停' : '播放'} shape="circle" size="large" className="music-player-play" icon={playing ? <PauseCircleFilled /> : <PlayCircleFilled />} onClick={toggle} />
                <Tooltip title="下一音质"><Button type="text" aria-label="下一音质" icon={<StepForwardOutlined />} onClick={() => hasQualitySelector ? void changeQuality(qualityOptions![Math.min(qualityOptions!.length - 1, qualityOptions!.findIndex((option) => option.value === quality) + 1)].value) : changeSource(Math.min(sources.length - 1, sourceIndex + 1))} disabled={qualityLoading || (hasQualitySelector ? qualityOptions!.findIndex((option) => option.value === quality) >= qualityOptions!.length - 1 : sourceIndex >= sources.length - 1)} /></Tooltip>
              </Space>
              <div className="music-playback-settings">
                <Select aria-label="播放速度" value={speed} onChange={setSpeed} options={[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => ({ value, label: `${value}x` }))} />
              </div>
            </div>
            {!compact && <div className="music-player-source-row">
              <div className="music-source-selector">
                <Typography.Text>播放音质</Typography.Text>
                {hasQualitySelector
                  ? <Select value={quality} loading={qualityLoading} disabled={qualityLoading} onChange={(value) => void changeQuality(value)} options={qualityOptions} />
                  : <Select value={sourceIndex} onChange={changeSource} options={sources.map((_, index) => ({ value: index, label: sourceLabel(index, sources.length, sourceLabels) }))} />}
              </div>
              <Space className="music-source-actions">
                <Button icon={<ShareAltOutlined />} onClick={() => void copyShareLink()}>分享链接</Button>
                {downloadSrc && <Button icon={<DownloadOutlined />} href={downloadSrc}>下载</Button>}
              </Space>
            </div>}
          </Col>
        </Row>
      </Card>
    </main>
  )
}
