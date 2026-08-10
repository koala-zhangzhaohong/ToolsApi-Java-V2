import {
  ApiOutlined,
  CodeOutlined,
  CustomerServiceOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlayCircleOutlined,
  ThunderboltFilled,
} from '@ant-design/icons'
import { Button, Drawer, Layout, Menu, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

const { Header, Content, Sider } = Layout

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: '工作台' },
  { key: '/douyin', icon: <ThunderboltFilled />, label: '抖音解析' },
  { key: '/netease', icon: <CustomerServiceOutlined />, label: '网易云搜索' },
  { key: '/kugou', icon: <CustomerServiceOutlined />, label: '酷狗搜索' },
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
  const selected = useMemo(
    () => {
      if (/^\/tools\/DouYin\/web|^\/tools\/json\/printer\/pro/.test(location.pathname)) return '/douyin'
      if (/^\/tools\/json\/printer$/.test(location.pathname)) return '/json'
      if (/^\/tools\/(DouYin|Netease|Kugou)\/pro\/player/.test(location.pathname)) return '/player'
      return menuItems.find((item) => item.key !== '/' && location.pathname.startsWith(item.key))?.key || '/'
    },
    [location.pathname],
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
      </Layout>
      <Drawer placement="left" width={260} open={drawerOpen} onClose={() => setDrawerOpen(false)} styles={{ body: { padding: 12 } }}>
        <div className="drawer-brand"><Brand /></div>
        {menu}
      </Drawer>
    </Layout>
  )
}
