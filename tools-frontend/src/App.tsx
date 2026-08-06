import { Spin } from 'antd'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'

const DouyinPage = lazy(() => import('./pages/DouyinPage'))
const ErrorPage = lazy(() => import('./pages/ErrorPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const JsonPage = lazy(() => import('./pages/JsonPage'))
const LegacyResultPage = lazy(() => import('./pages/LegacyResultPage'))
const LegacyPlayerPage = lazy(() => import('./pages/LegacyPlayerPage'))
const LegacySearchPage = lazy(() => import('./pages/LegacySearchPage'))
const LegacyJsonPage = lazy(() => import('./pages/LegacyJsonPage'))
const LegacyErrorPage = lazy(() => import('./pages/LegacyErrorPage'))
const MediaPage = lazy(() => import('./pages/MediaPage'))

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<div className="route-loading"><Spin size="large" /></div>}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="douyin" element={<DouyinPage />} />
            <Route path="json" element={<JsonPage />} />
            <Route path="player" element={<MediaPage />} />
            <Route path="tools/json/printer/pro" element={<LegacyResultPage />} />
            <Route path="tools/json/printer" element={<LegacyJsonPage />} />
            <Route path="tools/DouYin/web/v2/searcher" element={<LegacySearchPage />} />
            <Route path="tools/DouYin/pro/player/*" element={<LegacyPlayerPage />} />
            <Route path="tools/Netease/pro/player/*" element={<LegacyPlayerPage />} />
            <Route path="tools/Kugou/pro/player/*" element={<LegacyPlayerPage />} />
            <Route path="error/403" element={<LegacyErrorPage status={403} />} />
            <Route path="error/404" element={<LegacyErrorPage status={404} />} />
            <Route path="error/500" element={<LegacyErrorPage status={500} />} />
            <Route path="*" element={<ErrorPage status={404} />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
