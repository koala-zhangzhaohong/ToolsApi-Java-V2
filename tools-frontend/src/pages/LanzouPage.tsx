import {
  ClearOutlined,
  CloudDownloadOutlined,
  FileOutlined,
  HistoryOutlined,
  LockOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Alert, App, Button, Card, Col, Empty, Input, List, Row, Space, Spin, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../components/PageHeader'
import { useProgressiveRows } from '../hooks/useProgressiveRows'
import { apiUrl } from '../services/http'
import { lanzouApiPath, parseLanzouShare, type LanzouFileInfo, type LanzouResponse } from '../services/lanzou'

const historyKey = 'tools-frontend:lanzou-history'
const historyEvent = 'tools-frontend:lanzou-history-change'
const maxHistorySize = 8

interface LanzouHistoryItem {
  url: string
  password?: string
}

function normalizeHistoryItem(value: unknown): LanzouHistoryItem | null {
  if (typeof value === 'string') {
    const url = value.trim()
    return url ? { url } : null
  }
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const url = typeof item.url === 'string' ? item.url.trim() : ''
  if (!url) return null
  const password = typeof item.password === 'string' ? item.password.trim() : ''
  return password ? { url, password } : { url }
}

function uniqueHistory(value: unknown[]): LanzouHistoryItem[] {
  const seen = new Set<string>()
  const history: LanzouHistoryItem[] = []
  value.forEach((item) => {
    const normalized = normalizeHistoryItem(item)
    if (!normalized || seen.has(normalized.url)) return
    seen.add(normalized.url)
    history.push(normalized)
  })
  return history.slice(0, maxHistorySize)
}

function readHistory(): LanzouHistoryItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(historyKey) || '[]') as unknown
    return Array.isArray(value) ? uniqueHistory(value) : []
  } catch {
    return []
  }
}

function writeHistory(value: LanzouHistoryItem[]) {
  const history = uniqueHistory(value)
  localStorage.setItem(historyKey, JSON.stringify(history))
  window.dispatchEvent(new CustomEvent(historyEvent, { detail: history }))
  return history
}

function extractLanzouUrl(input: string) {
  const direct = input.trim()
  const urls = direct.match(/https?:\/\/[^\s"'<>]+/gi) || []
  const match = urls.find((url) => /lanzou/i.test(url)) || (/^https?:\/\//i.test(direct) && /lanzou/i.test(direct) ? direct : '')
  return match.replace(/[，。；、!！?？)）\]}]+$/, '')
}

function text(...values: unknown[]) {
  return values.find((value) => typeof value === 'string' && value.trim()) as string | undefined
}

function fileName(file: LanzouFileInfo, index: number) {
  return text(file.file_name, file.fileName) || `文件 ${index + 1}`
}

function directDownload(file: LanzouFileInfo) {
  const directUrl = text(file.redirect_url, file.redirectUrl, file.download_url, file.downloadUrl)
  if (directUrl) return directUrl

  const host = text(file.download_host, file.downloadHost)
  const path = text(file.download_path, file.downloadPath)
  if (!host || !path) return ''
  return `${host.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

function ResultFiles({ response, shareUrl, password }: { response: LanzouResponse; shareUrl: string; password: string }) {
  const files = useMemo(() => {
    if (Array.isArray(response.data)) return response.data
    return response.data && typeof response.data === 'object' ? [response.data] : []
  }, [response.data])
  const isFolder = Array.isArray(response.data)
  const { visibleRows, sentinelRef, hasHiddenRows } = useProgressiveRows(files, false, () => undefined)

  return (
    <Card
      className="lanzou-result-card"
      title={<Space><FileOutlined /> 解析结果</Space>}
      extra={<Typography.Text type="secondary">共 {files.length} 个文件</Typography.Text>}
    >
      {files.length ? (
        <>
          <Row gutter={[16, 16]}>
            {visibleRows.map((file, index) => {
              const download = !isFolder
                ? apiUrl(lanzouApiPath(shareUrl, password, 'download'))
                : directDownload(file)
              return (
                <Col xs={24} md={12} key={`${fileName(file, index)}-${index}`}>
                  <Card className="lanzou-file-card" size="small">
                    <div className="lanzou-file-icon"><FileOutlined /></div>
                    <div className="lanzou-file-content">
                      <Typography.Title level={4} ellipsis={{ tooltip: fileName(file, index) }}>{fileName(file, index)}</Typography.Title>
                      <Space wrap size={[14, 4]} className="lanzou-file-meta">
                        <Typography.Text type="secondary">大小：{text(file.file_size, file.fileSize) || '未知'}</Typography.Text>
                        <Typography.Text type="secondary">时间：{text(file.update_time, file.updateTime) || '未知'}</Typography.Text>
                        {text(file.author) && <Typography.Text type="secondary">发布者：{text(file.author)}</Typography.Text>}
                      </Space>
                      {download
                        ? <Button type="primary" href={download} icon={<CloudDownloadOutlined />}>下载文件</Button>
                        : <Button disabled icon={<CloudDownloadOutlined />}>暂无下载地址</Button>}
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>
          {hasHiddenRows && (
            <div ref={sentinelRef} className="progressive-list-footer">
              <Typography.Text type="secondary">继续向下滚动加载更多文件（已显示 {visibleRows.length} / {files.length}）</Typography.Text>
            </div>
          )}
        </>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="接口未返回文件信息" />}
    </Card>
  )
}

export default function LanzouPage() {
  const { message } = App.useApp()
  const [input, setInput] = useState('')
  const [password, setPassword] = useState('')
  const [history, setHistory] = useState<LanzouHistoryItem[]>(readHistory)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<LanzouResponse | null>(null)
  const [parsedUrl, setParsedUrl] = useState('')
  const [parsedPassword, setParsedPassword] = useState('')

  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail
      setHistory(Array.isArray(detail) ? uniqueHistory(detail) : readHistory())
    }
    const syncStorage = (event: StorageEvent) => { if (event.key === historyKey || event.key === null) setHistory(readHistory()) }
    window.addEventListener(historyEvent, sync)
    window.addEventListener('storage', syncStorage)
    return () => {
      window.removeEventListener(historyEvent, sync)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])

  const parse = useCallback(async (value = input, passwordValue = password) => {
    const url = extractLanzouUrl(value)
    if (!url) {
      message.warning('请输入有效的蓝奏云分享链接')
      return
    }
    setLoading(true)
    setError('')
    setResponse(null)
    try {
      const submittedPassword = passwordValue.trim()
      const result = await parseLanzouShare(url, submittedPassword)
      setInput(url)
      setParsedUrl(url)
      setParsedPassword(submittedPassword)
      setResponse(result)
      const historyItem: LanzouHistoryItem = submittedPassword ? { url, password: submittedPassword } : { url }
      setHistory(writeHistory([historyItem, ...readHistory().filter((item) => item.url !== url)]))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '蓝奏云解析失败')
    } finally {
      setLoading(false)
    }
  }, [input, message, password])

  const clearHistory = () => {
    localStorage.removeItem(historyKey)
    setHistory(writeHistory([]))
  }

  return (
    <div className="page-container">
      <PageHeader eyebrow="LANZOU PARSER" title="蓝奏云解析" description="解析蓝奏云文件或文件夹分享链接，并获取文件信息与下载地址。" />
      <Card className="search-panel lanzou-search-panel">
        <Input.Search
          size="large"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onSearch={(value) => void parse(value)}
          enterButton={loading ? <span className="search-button-label">立即解析</span> : <><SearchOutlined /><span className="search-button-label">立即解析</span></>}
          placeholder="粘贴蓝奏云分享链接"
          loading={loading}
          allowClear
        />
        <Input.Password
          name="lanzou-share-password"
          size="large"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onPressEnter={() => void parse()}
          prefix={<LockOutlined />}
          placeholder="提取密码（没有密码可留空）"
          autoComplete="new-password"
          allowClear
        />
      </Card>

      {loading && <div className="loading-panel"><Spin size="large" /><Typography.Text type="secondary">正在读取蓝奏云分享内容…</Typography.Text></div>}
      {error && <Alert className="page-feedback" type="error" showIcon closable message="解析失败" description={error} onClose={() => setError('')} />}
      {!loading && (
        <Card
          className="history-card"
          title={<Space><HistoryOutlined /> 最近解析</Space>}
          extra={history.length > 0 && <Button type="text" danger icon={<ClearOutlined />} onClick={clearHistory}>清空</Button>}
        >
          {history.length ? <List dataSource={history} renderItem={(item) => (
            <List.Item
              className="search-history-item"
              role="button"
              tabIndex={0}
              onClick={() => { setInput(item.url); setPassword(item.password || '') }}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setInput(item.url); setPassword(item.password || '') } }}
              actions={[<Button key="parse-again" type="link" onClick={(event) => { event.stopPropagation(); setInput(item.url); setPassword(item.password || ''); void parse(item.url, item.password || '') }}>再次解析</Button>]}
            >
              <Typography.Text ellipsis>{item.url}</Typography.Text>
            </List.Item>
          )} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无解析记录" />}
        </Card>
      )}
      {response && <div className="result-section"><ResultFiles response={response} shareUrl={parsedUrl} password={parsedPassword} /></div>}
    </div>
  )
}
