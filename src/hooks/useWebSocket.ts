import { useEffect, useRef, useCallback, useState } from 'react'
import { useMarketStore } from '@/store/marketStore'
import { generateMockData, generateNextTick } from '@/data/mockGenerator'
import type { OptionData } from '@/types/market'

const BRIDGE_URL = 'ws://localhost:8765'
const BATCH_MS = 200  // Batch option updates into 200ms windows

export function useWebSocket() {
  const [isLive, setIsLive] = useState(false)
  const [ready, setReady] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentDataRef = useRef<Record<number, OptionData>>({})
  const storeRef = useRef(useMarketStore.getState())

  // FIX: Batch option updates to prevent React overload during live market
  const pendingUpdatesRef = useRef<Record<number, OptionData>>({})
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep store ref up to date without causing re-renders
  useEffect(() => {
    const unsub = useMarketStore.subscribe((state) => {
      storeRef.current = state as any
    })
    return unsub
  }, [])

  const flushBatch = useCallback(() => {
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current)
      batchTimerRef.current = null
    }
    const pending = pendingUpdatesRef.current
    if (Object.keys(pending).length === 0) return

    // Merge pending updates into current data
    Object.entries(pending).forEach(([strikeStr, data]) => {
      currentDataRef.current[parseInt(strikeStr)] = data
    })
    pendingUpdatesRef.current = {}

    const store = storeRef.current
    store.updateOptionData(Object.values(currentDataRef.current).sort((a, b) => a.strike - b.strike))
  }, [])

  const queueOptionUpdate = useCallback((strike: number, optionType: 'CE' | 'PE', ltp: number, oi: number, volume: number) => {
    const existing = currentDataRef.current[strike] || {
      strike,
      ce: { ltp: 0, oi: 0, volume: 0, change: 0, prevOi: 0 },
      pe: { ltp: 0, oi: 0, volume: 0, change: 0, prevOi: 0 },
      lastUpdate: Date.now(),
    }

    const side = optionType === 'CE' ? 'ce' : 'pe'
    const oldOi = existing[side].oi
    const updated = {
      ...existing,
      [side]: {
        ltp,
        oi,
        volume,
        prevOi: oldOi,
        change: oi - oldOi,
      },
      lastUpdate: Date.now(),
    }

    pendingUpdatesRef.current[strike] = updated

    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(() => {
        flushBatch()
      }, BATCH_MS)
    }
  }, [flushBatch])

  const stopMock = useCallback(() => {
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current)
      mockIntervalRef.current = null
      console.log('[Mock] Stopped')
    }
  }, [])

  const startMock = useCallback(() => {
    if (mockIntervalRef.current) return
    console.log('[Mock] Starting...')

    const store = storeRef.current
    store.setConnectionStatus('connected')

    const initialData = generateMockData()
    initialData.forEach((d) => { currentDataRef.current[d.strike] = d })
    store.updateOptionData(initialData)
    store.updateSpot(22450.75, 'MOCK')
    store.updateFutures(22485.30, 'MOCK')
    store.setExpiryDate('18-AUG-2026')
    setReady(true)
    console.log('[Mock] Data loaded, table should appear')

    mockIntervalRef.current = setInterval(() => {
      const store = storeRef.current
      const next = generateNextTick(Object.values(currentDataRef.current))
      next.data.forEach((d) => { currentDataRef.current[d.strike] = d })
      store.updateOptionData(next.data)
      if (next.spotPrice) store.updateSpot(next.spotPrice, 'MOCK')
      if (next.futuresPrice) store.updateFutures(next.futuresPrice, 'MOCK')
      store.incrementMessageCount()
    }, 800)
  }, [stopMock])

  const connectBridge = useCallback(() => {
    console.log('[Bridge] Attempting connection to', BRIDGE_URL)
    try {
      const ws = new WebSocket(BRIDGE_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[Bridge] Connected!')
        storeRef.current.setConnectionStatus('connected')
        setIsLive(true)
        stopMock()
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          const store = storeRef.current
          store.incrementMessageCount()

          if (msg.type === 'snapshot') {
            flushBatch() // Flush any pending before snapshot
            if (msg.spotPrice) store.updateSpot(msg.spotPrice, msg.spotSource || 'BRIDGE')
            if (msg.futuresPrice) store.updateFutures(msg.futuresPrice, msg.futuresSource || 'BRIDGE')
            if (msg.expiryDate) store.setExpiryDate(msg.expiryDate)

            const optionData: OptionData[] = Object.entries(msg.optionData || {})
              .map(([strikeStr, data]: [string, any]) => {
                const strike = parseInt(strikeStr)
                const ce = data?.CE || { ltp: 0, oi: 0, volume: 0, prevOi: 0, change: 0 }
                const pe = data?.PE || { ltp: 0, oi: 0, volume: 0, prevOi: 0, change: 0 }
                return {
                  strike,
                  ce: { ltp: ce.ltp, oi: ce.oi, volume: ce.volume, change: ce.change, prevOi: ce.prevOi },
                  pe: { ltp: pe.ltp, oi: pe.oi, volume: pe.volume, change: pe.change, prevOi: pe.prevOi },
                  lastUpdate: Date.now(),
                }
              })
              .sort((a, b) => a.strike - b.strike)

            optionData.forEach((d) => { currentDataRef.current[d.strike] = d })
            store.updateOptionData(optionData)
          }
          else if (msg.type === 'spot') {
            store.updateSpot(msg.price, msg.source)
          }
          else if (msg.type === 'futures') {
            store.updateFutures(msg.price, msg.source)
          }
          else if (msg.type === 'option') {
            // FIX: Batch option updates instead of immediate store push
            queueOptionUpdate(msg.strike, msg.optionType, msg.ltp, msg.oi, msg.volume)
          }
        } catch (e) {
          console.error('[Bridge] Parse error:', e)
        }
      }

      ws.onerror = (error) => {
        console.error('[Bridge] Error:', error)
        storeRef.current.setConnectionStatus('error')
      }

      ws.onclose = () => {
        console.log('[Bridge] Disconnected')
        flushBatch()
        storeRef.current.setConnectionStatus('disconnected')
        wsRef.current = null
        setIsLive(false)
        startMock()
        setTimeout(() => connectBridge(), 5000)
      }
    } catch (e) {
      console.error('[Bridge] Connection failed:', e)
    }
  }, [startMock, stopMock, flushBatch, queueOptionUpdate])

  useEffect(() => {
    console.log('[App] Mounting useWebSocket hook')
    startMock()
    const t = setTimeout(() => connectBridge(), 1000)

    return () => {
      console.log('[App] Unmounting useWebSocket hook')
      clearTimeout(t)
      flushBatch()
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      stopMock()
    }
  }, [startMock, stopMock, connectBridge, flushBatch])

  return { isLive, ready }
}
