import { ClearOutlined, CloudDownloadOutlined, CopyOutlined, FormatPainterOutlined, LinkOutlined, SendOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Input, Segmented, Space, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import JsonTree from '../components/JsonTree'
import PageHeader from '../components/PageHeader'
import { getJson } from '../services/http'

const sample = `{
  "project": "ToolsApi-Java-V2",
  "frontend": "Ant Design",
  "features": ["format", "validate", "preview"]
}`

type ViewMode = '树形' | '源码'

export default function JsonPage() {
  const { message } = App.useApp()
  const [params] = useSearchParams()
  const [input, setInput] = useState(params.get('data') || sample)
  const [url, setUrl] = useState(params.get('url') || params.get('path') || '')
  const [data, setData] = useState<unknown>(() => JSON.parse(sample))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<ViewMode>('树形')

  const formatted = useMemo(() => {
    try { return JSON.stringify(data, null, 2) } catch { return '' }
  }, [data])

  const parse = (text = input) => {
    try {
      const value = JSON.parse(text) as unknown
      setData(value)
      setInput(JSON.stringify(value, null, 2))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'JSON 格式错误')
    }
  }

  const requestUrl = async (target = url) => {
    if (!target.trim()) { message.warning('请输入接口 URL'); return }
    setLoading(true)
    setError('')
    try {
      const value = await getJson<unknown>(target.trim())
      setData(value)
      setInput(JSON.stringify(value, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initialUrl = params.get('url') || params.get('path')
    if (initialUrl) void requestUrl(initialUrl)
    // 只处理首次进入时携带的兼容参数
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(formatted)
    message.success('已复制到剪贴板')
  }
  const download = () => {
    const blob = new Blob([formatted], { type: 'application/json;charset=utf-8' })
    const anchor = document.createElement('a')
    anchor.href = URL.createObjectURL(blob)
    anchor.download = 'data.json'
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  return (
    <div className="page-container">
      <PageHeader eyebrow="JSON WORKBENCH" title="JSON 工作台" />
      <Card className="url-card">
        <Input.Search
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onSearch={requestUrl}
          enterButton={<><SendOutlined /><span className="search-button-label">请求</span></>}
          loading={loading}
          prefix={<LinkOutlined />}
          placeholder="输入 JSON 接口地址，例如 /tools/DouYin/api?..."
        />
      </Card>
      {error && <Alert className="json-error" type="error" showIcon closable message="处理失败" description={error} onClose={() => setError('')} />}
      <div className="json-workbench">
        <Card
          title="输入"
          extra={<Space><Button icon={<FormatPainterOutlined />} onClick={() => parse()}>格式化</Button><Button icon={<ClearOutlined />} onClick={() => { setInput(''); setData(null); setError('') }}>清空</Button></Space>}
        >
          <Input.TextArea className="json-editor" value={input} onChange={(event) => setInput(event.target.value)} onBlur={() => input.trim() && parse()} spellCheck={false} />
        </Card>
        <Card
          title="预览"
          extra={<Space wrap><Segmented options={['树形', '源码']} value={mode} onChange={(value) => setMode(value as ViewMode)} /><Button icon={<CopyOutlined />} onClick={copy}>复制</Button><Button icon={<CloudDownloadOutlined />} onClick={download}>下载</Button></Space>}
        >
          <div className="json-preview">
            {mode === '树形' ? <JsonTree data={data} /> : <pre>{formatted}</pre>}
          </div>
        </Card>
      </div>
      <Typography.Paragraph type="secondary" className="cors-note">远程地址需要允许浏览器跨域访问；访问项目后端接口时会自动使用开发代理或 VITE_API_BASE_URL。</Typography.Paragraph>
    </div>
  )
}
