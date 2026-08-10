import { useEffect, useMemo, useRef, useState } from 'react'

const initialVisibleRows = 24
const visibleRowsStep = 24

export function useProgressiveRows<T>(rows: T[], hasMore: boolean, onLoadMore: () => void) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleRows)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount])
  const hasHiddenRows = visibleCount < rows.length

  useEffect(() => {
    if (rows.length <= initialVisibleRows) {
      setVisibleCount(initialVisibleRows)
    }
  }, [rows.length])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || (!hasHiddenRows && !hasMore)) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (hasHiddenRows) {
          setVisibleCount((current) => Math.min(current + visibleRowsStep, rows.length))
        } else {
          onLoadMore()
        }
      },
      { rootMargin: '360px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasHiddenRows, hasMore, onLoadMore, rows.length])

  return {
    visibleRows,
    sentinelRef,
    hasHiddenRows,
  }
}
