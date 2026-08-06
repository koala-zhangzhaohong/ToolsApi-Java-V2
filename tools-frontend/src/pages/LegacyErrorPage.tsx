import { HomeOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Result, Space } from 'antd'

export default function LegacyErrorPage({ status }: { status: 403 | 404 | 500 }) {
  const copy = {
    403: ['访问受限', '当前请求没有访问此页面的权限。'],
    404: ['页面走丢了', '请求的资源不存在、已过期或已经迁移。'],
    500: ['服务开小差了', '服务器暂时无法完成这次请求，请稍后重试。'],
  }[status]
  return <main className={`legacy-error legacy-error-${status}`}><Card className="legacy-error-card" bordered={false}><Result status={status} icon={<div className="error-orbit"><strong>{status}</strong></div>} title={copy[0]} subTitle={copy[1]} extra={<Space wrap><Button type="primary" icon={<HomeOutlined />} href="/">返回首页</Button>{status === 500 && <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>重新加载</Button>}</Space>} /></Card></main>
}
