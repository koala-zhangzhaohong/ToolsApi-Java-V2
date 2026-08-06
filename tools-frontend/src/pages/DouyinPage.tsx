import {
  ClearOutlined,
  CloudDownloadOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, App, Button, Card, Col, Empty, Input, List, Row, Space, Spin, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { douyinExamples } from '../constants/douyinExamples'
import { useParseHistory } from '../hooks/useParseHistory'
import JsonTree from '../components/JsonTree'
import { parseDouyinShare } from '../services/douyin'
import type { DouyinResult } from '../types'
import { mediaRouteLabel } from '../utils/mediaRoute'
import { specialRankRouteLabel } from '../utils/rankRoute'

function content(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function ResultLinks({ result }: { result: DouyinResult }) {
  const media = useMemo(() => result.media_data || {}, [result.media_data])
  const rank = useMemo(() => result.rank_data || {}, [result.rank_data])
  const previews = useMemo(() => {
    const values = [
      ...(Array.isArray(media.proxy_preview_path) ? media.proxy_preview_path : []),
      media.preview_path,
      media.preview_path_hls,
      media.preview_path_flv,
    ]
    return [...new Set(values.filter(content))]
  }, [media])
  const downloads = useMemo(() => {
    const values: string[] = []
    if (content(media.download_path)) values.push(media.download_path)
    if (Array.isArray(media.proxy_download_path)) {
      media.proxy_download_path.forEach((item) => Object.values(item).forEach((value) => content(value) && values.push(value)))
    }
    return [...new Set(values)]
  }, [media])
  const ranks = [
    ...(content(rank.rank_list_url) ? [{ url: rank.rank_list_url, label: '用户查询[简略]' }] : []),
    ...(content(rank.rank_list_url_backup) ? [{ url: rank.rank_list_url_backup, label: '用户反查[Pro]' }] : []),
    ...(rank.rank_list_special || []).filter(content).map((url, index) => ({ url, label: specialRankRouteLabel(url, index) })),
  ]

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10}>
        <Card className="result-card" title="内容信息">
          <Space direction="vertical" size={4}>
            <Typography.Title level={4}>{result.desc || result.title || '未命名内容'}</Typography.Title>
            <Typography.Text type="secondary"><UserOutlined /> {result.nickname || '未知作者'}</Typography.Text>
            <Typography.Text type="secondary">ID：{result.unique_id || result.room_id || result.song_id || '—'}</Typography.Text>
            <Typography.Text type="secondary">UID：{result.user_id || result.sec_uid || '—'}</Typography.Text>
          </Space>
        </Card>
      </Col>
      <Col xs={24} lg={14}>
        <Card className="result-card" title="可用线路">
              {!previews.length && !downloads.length && !ranks.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="接口未返回媒体线路" /> : (
            <Space direction="vertical" size={14} className="full-width">
              {previews.length > 0 && <div><Typography.Text strong><PlayCircleOutlined /> 预览</Typography.Text><div className="link-grid">{previews.map((url, index) => <Button key={url} href={url} target="_blank" icon={<PlayCircleOutlined />}>{mediaRouteLabel(url, index)}</Button>)}</div></div>}
              {downloads.length > 0 && <div><Typography.Text strong><CloudDownloadOutlined /> 下载</Typography.Text><div className="link-grid">{downloads.map((url, index) => <Button key={url} href={url} target="_blank" icon={<CloudDownloadOutlined />}>线路 {index + 1}</Button>)}</div></div>}
              {ranks.length > 0 && <div><Typography.Text strong><LinkOutlined /> 榜单</Typography.Text><div className="link-grid">{ranks.map(({ url, label }) => <Button key={url} href={`/json?url=${encodeURIComponent(url)}`} target="_blank">{label}</Button>)}</div></div>}
            </Space>
          )}
        </Card>
      </Col>
    </Row>
  )
}

export default function DouyinPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DouyinResult | null>(null)
  const [error, setError] = useState('')
  const { history, addHistory, clearHistory } = useParseHistory()

  const search = async (value = input) => {
    const link = value.trim()
    if (!link) { message.warning('请先输入分享链接'); return }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const { result: data, proPath } = await parseDouyinShare(link)
      addHistory(link)
      if (proPath) {
        navigate(proPath, { state: { data, parseInput: link } })
        return
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <PageHeader eyebrow="DOUYIN PARSER" title="抖音智能解析" description="支持视频、直播、图文与音乐分享内容。" />
      <Card className="search-panel">
        <Input.Search
          size="large"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onSearch={search}
          enterButton={<><SearchOutlined /> 立即解析</>}
          placeholder="粘贴完整的抖音分享文本或链接"
          loading={loading}
          allowClear
        />
        <Space wrap className="suggestions">
          <Typography.Text type="secondary">快捷输入</Typography.Text>
          {douyinExamples.map((item) => <Tag key={item.label} onClick={() => setInput(item.value)}>{item.label}</Tag>)}
        </Space>
        <Alert className="usage-alert" type="info" showIcon message="说明" description="返回链接中含 preview 的为预览线路，含 download 的为下载线路，proxy 为代理线路。内容仅供学习使用。" />
      </Card>

      {loading && <div className="loading-panel"><Spin size="large" /><Typography.Text type="secondary">正在解析分享内容…</Typography.Text></div>}
      {error && <Alert type="error" showIcon closable message="解析失败" description={error} onClose={() => setError('')} />}
      {result && <div className="result-section"><ResultLinks result={result} /><Card title="完整响应" className="json-response"><JsonTree data={result} /></Card></div>}
      {!result && !loading && !error && (
        <Card
          className="history-card"
          title={<Space><HistoryOutlined /> 最近解析</Space>}
          extra={history.length > 0 && <Button type="text" danger icon={<ClearOutlined />} onClick={clearHistory}>清空</Button>}
        >
          {history.length ? <List dataSource={history} renderItem={(item) => <List.Item actions={[<Button type="link" onClick={() => { setInput(item); void search(item) }}>再次解析</Button>]}><Typography.Text ellipsis>{item}</Typography.Text></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无解析记录" />}
        </Card>
      )}
    </div>
  )
}
