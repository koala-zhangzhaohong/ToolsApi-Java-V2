import {
  CopyOutlined,
  CustomerServiceOutlined,
  DownloadOutlined,
  FileTextOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
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

function sourceLabel(index: number, total: number) {
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
}

export default function MusicPlayerPage({ data, sources }: MusicPlayerPageProps) {
  const { message } = App.useApp()
  const meta = useMemo(() => musicMeta(data), [data])
  const lines = useMemo(() => parseLyrics(meta.lyric), [meta.lyric])
  const audioRef = useRef<HTMLAudioElement>(null)
  const lyricBoxRef = useRef<HTMLDivElement>(null)
  const resumeAfterSourceChange = useRef(false)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(80)
  const [speed, setSpeed] = useState(1)
  const [lyricIndex, setLyricIndex] = useState(-1)
  const [showLyrics, setShowLyrics] = useState(true)
  const [playbackError, setPlaybackError] = useState('')
  const src = sources[sourceIndex] || sources[0]

  useEffect(() => {
    setSourceIndex(0)
    setCurrentTime(0)
    setDuration(0)
    setLyricIndex(-1)
    setPlaybackError('')
  }, [sources])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !src) return
    audio.pause()
    audio.load()
    const resume = () => {
      if (!resumeAfterSourceChange.current) return
      resumeAfterSourceChange.current = false
      void audio.play().catch(() => setPlaybackError('浏览器阻止了自动播放，请点击播放按钮'))
    }
    audio.addEventListener('loadedmetadata', resume, { once: true })
    return () => audio.removeEventListener('loadedmetadata', resume)
  }, [src])

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
    if (audio.paused) void audio.play().catch(() => setPlaybackError('媒体地址不可播放，链接可能已过期'))
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
      if (audio.paused) void audio.play().catch(() => setPlaybackError('媒体地址不可播放，链接可能已过期'))
      else audio.pause()
    }
    window.addEventListener('keydown', handleSpacePlayback)
    return () => window.removeEventListener('keydown', handleSpacePlayback)
  }, [src])

  const changeSource = (next: number) => {
    const audio = audioRef.current
    resumeAfterSourceChange.current = Boolean(audio && !audio.paused)
    setSourceIndex(next)
    setPlaybackError('')
  }

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrentTime(value)
    setLyricIndex(activeLyricIndex(lines, value))
  }

  const copySource = async () => {
    if (!src) return
    try {
      await navigator.clipboard.writeText(src)
      message.success('播放地址已复制')
    } catch {
      message.warning('复制失败，请手动打开源地址')
    }
  }

  return (
    <main className="music-player-page">
      <Card className="music-player-shell" bordered={false}>
        <div className="music-player-background" style={meta.cover ? { backgroundImage: `linear-gradient(120deg, rgba(10,12,22,.95), rgba(20,20,42,.88)), url(${meta.cover})` } : undefined} />
        <Row gutter={[32, 32]} className="music-player-grid">
          <Col xs={24} md={9} className="music-player-art-column">
            <div className={`music-player-disc ${playing ? 'is-playing' : ''}`}>
              {meta.cover ? <img src={meta.cover} alt={`${meta.title}专辑封面`} /> : <CustomerServiceOutlined />}
            </div>
            <Tag color="purple">{meta.album || '音乐播放器'}</Tag>
            <Typography.Title level={2}>{meta.title}</Typography.Title>
            <Typography.Text className="music-player-artist">{meta.artist}</Typography.Text>
            <div className="music-player-art-actions">
              <Button icon={<FileTextOutlined />} onClick={() => setShowLyrics((value) => !value)}>{showLyrics ? '隐藏歌词' : '显示歌词'}</Button>
            </div>
          </Col>
          <Col xs={24} md={15} className="music-player-main-column">
            <div className="music-player-topline"><Typography.Text>NOW PLAYING</Typography.Text><span>{sourceIndex + 1}/{Math.max(1, sources.length)} 线路</span></div>
            <div className="music-player-current-lyric">{lines[lyricIndex]?.text || (lines.length ? '准备播放' : '暂无歌词')}</div>
            {showLyrics && <div className="music-lyrics-panel" ref={lyricBoxRef} aria-label="歌词">
              {lines.length ? lines.map((line) => <button key={`${line.time}-${line.index}`} data-lyric-index={line.index} className={line.index === lyricIndex ? 'active' : ''} onClick={() => seek(line.time)}>{line.text}</button>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无歌词" />}
            </div>}
            {playbackError && <Typography.Text type="danger" className="music-player-error">{playbackError}</Typography.Text>}
            <Waveform title={`${meta.title}-${meta.artist}`} currentTime={currentTime} duration={duration} playing={playing} onSeek={seek} />
            <Slider className="music-progress-slider" min={0} max={duration || 1} value={Math.min(currentTime, duration || 1)} onChange={seek} tooltip={{ formatter: (value) => formatTime(Number(value)) }} />
            <div className="music-time-row"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
            <audio ref={audioRef} src={src} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onTimeUpdate={(event) => { const time = event.currentTarget.currentTime; setCurrentTime(time); setLyricIndex(activeLyricIndex(lines, time)) }} onError={() => setPlaybackError('媒体地址不可播放，链接可能已过期')} />
            <div className="music-player-controls">
              <div className="music-volume-control">
                <Tooltip title="音量"><SoundOutlined /></Tooltip>
                <Slider className="music-volume-slider" min={0} max={100} value={volume} onChange={setVolume} />
              </div>
              <Space className="music-transport-controls" size={6}>
                <Tooltip title="上一线路"><Button type="text" aria-label="上一线路" icon={<StepBackwardOutlined />} onClick={() => changeSource(Math.max(0, sourceIndex - 1))} disabled={sourceIndex === 0} /></Tooltip>
                <Button type="primary" aria-label={playing ? '暂停' : '播放'} shape="circle" size="large" className="music-player-play" icon={playing ? <PauseCircleFilled /> : <PlayCircleFilled />} onClick={toggle} />
                <Tooltip title="下一线路"><Button type="text" aria-label="下一线路" icon={<StepForwardOutlined />} onClick={() => changeSource(Math.min(sources.length - 1, sourceIndex + 1))} disabled={sourceIndex >= sources.length - 1} /></Tooltip>
              </Space>
              <div className="music-playback-settings">
                <Select aria-label="播放速度" value={speed} onChange={setSpeed} options={[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => ({ value, label: `${value}x` }))} />
              </div>
            </div>
            <div className="music-player-source-row">
              <div className="music-source-selector">
                <Typography.Text>播放线路</Typography.Text>
                <Select value={sourceIndex} onChange={changeSource} options={sources.map((_, index) => ({ value: index, label: sourceLabel(index, sources.length) }))} />
              </div>
              <Space className="music-source-actions"><Button icon={<CopyOutlined />} onClick={() => void copySource()}>复制地址</Button>{src && <Button icon={<DownloadOutlined />} href={src} target="_blank" rel="noreferrer">打开源地址</Button>}</Space>
            </div>
          </Col>
        </Row>
      </Card>
    </main>
  )
}
