import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#6d5dfc',
          borderRadius: 12,
          colorText: '#172033',
          fontFamily: "Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        },
        components: {
          Layout: { bodyBg: '#f5f6fa', headerBg: 'rgba(255,255,255,.86)' },
          Card: { headerBg: 'transparent' },
        },
      }}
    >
      <AntApp>
        <App />
      </AntApp>
  </ConfigProvider>,
)
