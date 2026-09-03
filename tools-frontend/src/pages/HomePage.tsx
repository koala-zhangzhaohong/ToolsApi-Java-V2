import { CloudDownloadOutlined, CodeOutlined, CustomerServiceOutlined, LinkOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, Card, Col, Row, Space, Tag, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'

const tools = [
  {
    title: '抖音智能解析',
    description: '解析视频、直播、图文与音乐分享链接，并集中展示预览及下载线路。',
    path: '/douyin',
    icon: <ThunderboltOutlined />,
    color: 'purple',
  },
  {
    title: '网易云音乐搜索',
    description: '搜索网易云单曲与 MV，搜索结果可继续解析播放。',
    path: '/netease',
    icon: <CustomerServiceOutlined />,
    color: 'red',
  },
  {
    title: '酷狗音乐搜索',
    description: '搜索酷狗单曲与 MV，单曲结果可继续解析播放。',
    path: '/kugou',
    icon: <CustomerServiceOutlined />,
    color: 'cyan',
  },
  {
    title: '蓝奏云解析',
    description: '解析蓝奏云文件与文件夹分享链接，支持带提取密码的分享内容。',
    path: '/lanzou',
    icon: <CloudDownloadOutlined />,
    color: 'blue',
  },
  {
    title: 'JSON 工作台',
    description: '粘贴 JSON 或请求远程接口，完成校验、格式化、压缩与复制。',
    path: '/json',
    icon: <CodeOutlined />,
    color: 'blue',
  },
  {
    title: '媒体播放器',
    description: '统一承载视频、音频、HLS、图片集合，替代分散的播放器模板。',
    path: '/player',
    icon: <PlayCircleOutlined />,
    color: 'purple',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  return (
    <div className="page-container">
      <section className="hero-panel">
        <Tag color="purple" bordered={false}>TOOLS API / FRONTEND</Tag>
        <Typography.Title>让常用工具，回到一个清晰的界面。</Typography.Title>
        <Typography.Paragraph className="hero-description">
          原 Spring Boot 模板页已整理为独立前端工程。页面与服务解耦，开发、部署和后续扩展都可以独立进行。
        </Typography.Paragraph>
        <Space wrap>
          <Button type="primary" size="large" icon={<ThunderboltOutlined />} onClick={() => navigate('/douyin')}>开始解析</Button>
          <Button size="large" icon={<LinkOutlined />} onClick={() => navigate('/json')}>打开 JSON 工具</Button>
        </Space>
      </section>

      <PageHeader eyebrow="TOOLKIT" title="工具集合" description="迁移后的核心页面均从这里进入。" />
      <Row gutter={[18, 18]} className="tool-grid">
        {tools.map((tool) => (
          <Col xs={24} md={12} xl={6} key={tool.path}>
            <Card className="tool-card" hoverable onClick={() => navigate(tool.path)}>
              <span className={`tool-icon tool-icon-${tool.color}`}>{tool.icon}</span>
              <Typography.Title level={3}>{tool.title}</Typography.Title>
              <Typography.Paragraph type="secondary">{tool.description}</Typography.Paragraph>
              <Button type="link" className="card-link">立即使用 →</Button>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
