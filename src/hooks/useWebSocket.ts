import { useEffect, useRef, useCallback, useState } from 'react'
import { useMarketStore } from '@/store/marketStore'
import { generateMockData, generateNextTick } from '@/data/mockGenerator'
import type { OptionData } from '@/types/market'

const BRIDGE_URL = 'ws://localhost:8765'

export function useWebSocket() {
  const [isLive, setIsLive] = useState(false)
  const [ready, setReady] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentDataRef = useRef<Record<number, OptionData>>({})
  const storeRef = useRef(useMarketStore.getState())

  // Keep store ref up to date without causing re-renders
  useEffect(() => {
    const unsub = useMarketStore.subscribe((state) => {
      storeRef.current = state as any
    })
    return unsub
  }, [])

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
            const existing = currentDataRef.current[msg.strike]
            if (!existing) {
              currentDataRef.current[msg.strike] = {
                strike: msg.strike,
                ce: { ltp: 0, oi: 0, volume: 0, change: 0, prevOi: 0 },
                pe: { ltp: 0, oi: 0, volume: 0, change: 0, prevOi: 0 },
                lastUpdate: Date.now(),
              }
            }
            const updated = { ...currentDataRef.current[msg.strike] }
            const side = msg.optionType === 'CE' ? 'ce' : 'pe'
            const oldOi = updated[side].oi
            updated[side] = {
              ltp: msg.ltp,
              oi: msg.oi,
              volume: msg.volume,
              prevOi: oldOi,
              change: msg.oi - oldOi,
            }
            updated.lastUpdate = Date.now()
            currentDataRef.current[msg.strike] = updated
            store.updateOptionData(Object.values(currentDataRef.current).sort((a, b) => a.strike - b.strike))
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
        storeRef.current.setConnectionStatus('disconnected')
        wsRef.current = null
        setIsLive(false)
        startMock()
        setTimeout(() => connectBridge(), 5000)
      }
    } catch (e) {
      console.error('[Bridge] Connection failed:', e)
    }
  }, [startMock, stopMock])

  useEffect(() => {
    console.log('[App] Mounting useWebSocket hook')

    // Start mock immediately
    startMock()

    // Try bridge after 1s
    const t = setTimeout(() => connectBridge(), 1000)

    return () => {
      console.log('[App] Unmounting useWebSocket hook')
      clearTimeout(t)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      stopMock()
    }
  }, [startMock, stopMock, connectBridge])

  return { isLive, ready }
}
