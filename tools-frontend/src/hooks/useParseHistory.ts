import { useCallback, useEffect, useState } from 'react'

const historyKey = 'tools-frontend:douyin-history'
const legacyHistoryKeys = ['tools-frontend:legacy-search-history']
const historyChangedEvent = 'tools-frontend:parse-history-change'
const maxHistorySize = 8

function parseHistory(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : []
  } catch {
    return []
  }
}

function uniqueHistory(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].slice(0, maxHistorySize)
}

function readHistory() {
  const history = uniqueHistory([
    ...parseHistory(localStorage.getItem(historyKey)),
    ...legacyHistoryKeys.flatMap((key) => parseHistory(localStorage.getItem(key))),
  ])

  // 旧搜索页曾使用独立的 key；读取时完成一次无损迁移，之后所有页面共享同一份数据。
  localStorage.setItem(historyKey, JSON.stringify(history))
  legacyHistoryKeys.forEach((key) => localStorage.removeItem(key))
  return history
}

function writeHistory(history: string[]) {
  const next = uniqueHistory(history)
  localStorage.setItem(historyKey, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(historyChangedEvent, { detail: next }))
  return next
}

export function useParseHistory() {
  const [history, setHistory] = useState<string[]>(readHistory)

  useEffect(() => {
    const sync = () => setHistory(readHistory())
    const syncCurrentPage = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail
      setHistory(Array.isArray(detail) ? uniqueHistory(detail.filter((item): item is string => typeof item === 'string')) : readHistory())
    }
    const syncOtherPage = (event: StorageEvent) => {
      if (event.key === historyKey || event.key === null || legacyHistoryKeys.includes(event.key)) sync()
    }
    window.addEventListener(historyChangedEvent, syncCurrentPage)
    window.addEventListener('storage', syncOtherPage)
    return () => {
      window.removeEventListener(historyChangedEvent, syncCurrentPage)
      window.removeEventListener('storage', syncOtherPage)
    }
  }, [])

  const addHistory = useCallback((input: string) => {
    setHistory(writeHistory([input, ...readHistory().filter((item) => item !== input.trim())]))
  }, [])

  const clearHistory = useCallback(() => {
    legacyHistoryKeys.forEach((key) => localStorage.removeItem(key))
    setHistory(writeHistory([]))
  }, [])

  return { history, addHistory, clearHistory }
}
