import {
  ApiOutlined,
  CodeOutlined,
  CloudDownloadOutlined,
  CustomerServiceOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined,
  ThunderboltFilled,
} from '@ant-design/icons'
import { Button, Drawer, Layout, Menu, Space, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { readMusicPlayback } from '../services/musicPlayback'

const { Header, Content, Footer, Sider } = Layout

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '工作台' },
  { key: '/douyin', icon: <ThunderboltFilled />, label: '抖音解析' },
  { key: '/netease', icon: <CustomerServiceOutlined />, label: '网易云搜索' },
  { key: '/kugou', icon: <CustomerServiceOutlined />, label: '酷狗搜索' },
  { key: '/lanzou', icon: <CloudDownloadOutlined />, label: '蓝奏云解析' },
  { key: '/json', icon: <CodeOutlined />, label: 'JSON 工具' },
  { key: '/player', icon: <PlayCircleOutlined />, label: '媒体播放器' },
]

function Brand() {
  return (
    <Space size={10} className="brand">
      <span className="brand-mark"><ApiOutlined /></span>
      <Typography.Text strong className="brand-name">Tools Console</Typography.Text>
    </Space>
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [serviceInfo, setServiceInfo] = useState({ version: __APP_VERSION__, buildTime: __COMPILE_DATE__ })
  useEffect(() => {
    fetch('/backend/info', { headers: { Accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((response: { data?: { version?: string; buildTime?: string } }) => {
        if (response.data?.version && response.data?.buildTime) setServiceInfo(response.data as { version: string; buildTime: string })
      })
      .catch(() => undefined)
  }, [])
  const selected = useMemo(
    () => {
      if (/^\/tools\/DouYin\/web|^\/tools\/json\/printer\/pro/.test(location.pathname)) return '/douyin'
      if (/^\/tools\/json\/printer$/.test(location.pathname)) return '/json'
      if (/^\/tools\/(DouYin|Netease|Kugou)\/pro\/player/.test(location.pathname)) return '/player'
      if (/^\/music\/player/.test(location.pathname)) {
        const source = new URLSearchParams(location.search).get('from')
        if (source === 'netease') return '/netease'
        if (source === 'kugou') return '/kugou'
        const key = new URLSearchParams(location.search).get('key')
        const payload = key ? readMusicPlayback(key) : null
        if (payload?.platform === 'netease') return '/netease'
        if (payload?.platform === 'kugou') return '/kugou'
        return '/player'
      }
      return menuItems.find((item) => item.key !== '/' && location.pathname.startsWith(item.key))?.key || '/'
    },
    [location.pathname, location.search],
  )
  const onSelect = ({ key }: { key: string }) => {
    navigate(key)
    setDrawerOpen(false)
  }
  const menu = <Menu mode="inline" selectedKeys={[selected]} items={menuItems} onClick={onSelect} />

  if (new URLSearchParams(location.search).get('embed') === '1') return <Outlet />

  return (
    <Layout className="app-shell">
      <Sider className="desktop-sider" width={230} collapsedWidth={78} collapsed={collapsed} theme="light">
        <div className="sider-brand"><Brand /></div>
        {menu}
        <Button
          className="collapse-button"
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed((value) => !value)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <div className="mobile-brand"><Brand /></div>
          <Button className="mobile-menu-button" type="text" icon={<MenuUnfoldOutlined />} onClick={() => setDrawerOpen(true)} />
          <Typography.Text type="secondary" className="header-note">ToolsApi Java · 独立前端</Typography.Text>
        </Header>
        <Content className="app-content"><Outlet /></Content>
        <Footer className="app-footer">© API Service {serviceInfo.version} CP{serviceInfo.buildTime}</Footer>
      </Layout>
      <Drawer placement="left" width={260} open={drawerOpen} onClose={() => setDrawerOpen(false)} styles={{ body: { padding: 12 } }}>
        <div className="drawer-brand"><Brand /></div>
        {menu}
      </Drawer>
    </Layout>
  )
}
