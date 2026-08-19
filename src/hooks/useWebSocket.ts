import { useEffect, useRef, useCallback, useState } from 'react'
import { useMarketStore } from '@/store/marketStore'
import { generateMockData, generateNextTick } from '@/data/mockGenerator'
import { INSTRUMENTS } from '@/lib/utils'
import type { OptionData, Instrument } from '@/types/market'

const BRIDGE_URL = 'ws://localhost:8765'
const BATCH_MS = 200

export function useWebSocket() {
  const [isLive, setIsLive] = useState(false)
  const [ready, setReady] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const mockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentDataRef = useRef<Record<number, OptionData>>({})
  const storeRef = useRef(useMarketStore.getState())
  const pendingUpdatesRef = useRef<Record<number, OptionData>>({})
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instrumentRef = useRef<Instrument>('NIFTY')
  const liveModeRef = useRef(false)  // Prevents mock from overwriting live data

  useEffect(() => {
    const unsub = useMarketStore.subscribe((state) => {
      storeRef.current = state as any
      instrumentRef.current = (state as any).instrument
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
    Object.entries(pending).forEach(([strikeStr, data]) => {
      currentDataRef.current[parseInt(strikeStr)] = data
    })
    pendingUpdatesRef.current = {}
    storeRef.current.updateOptionData(Object.values(currentDataRef.current).sort((a, b) => a.strike - b.strike))
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
    currentDataRef.current[strike] = {
      ...existing,
      [side]: { ltp, oi, volume, prevOi: oldOi, change: oi - oldOi },
      lastUpdate: Date.now(),
    }
    pendingUpdatesRef.current[strike] = currentDataRef.current[strike]
    if (!batchTimerRef.current) {
      batchTimerRef.current = setTimeout(() => flushBatch(), BATCH_MS)
    }
  }, [flushBatch])

  const stopMock = useCallback(() => {
    if (mockIntervalRef.current) {
      clearInterval(mockIntervalRef.current)
      mockIntervalRef.current = null
    }
  }, [])

  const startMock = useCallback((instrument: Instrument = 'NIFTY') => {
    if (mockIntervalRef.current) stopMock()
    console.log('[Mock] Starting for', instrument)
    const store = storeRef.current
    store.setConnectionStatus('connected')
    const initialData = generateMockData(instrument)
    currentDataRef.current = {}
    initialData.forEach((d) => { currentDataRef.current[d.strike] = d })
    store.updateOptionData(initialData)
    store.updateSpot(22450.75, 'MOCK')
    store.updateFutures(22485.30, 'MOCK')
    store.setExpiryDate('18-AUG-2026')
    setReady(true)

    mockIntervalRef.current = setInterval(() => {
      if (liveModeRef.current) return  // BLOCK: never overwrite live data
      const store = storeRef.current
      const next = generateNextTick(Object.values(currentDataRef.current), instrument)
      next.data.forEach((d) => { currentDataRef.current[d.strike] = d })
      store.updateOptionData(next.data)
      if (next.spotPrice) store.updateSpot(next.spotPrice, 'MOCK')
      if (next.futuresPrice) store.updateFutures(next.futuresPrice, 'MOCK')
      store.incrementMessageCount()
    }, 800)
  }, [stopMock])

  const connectBridge = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    try {
      const ws = new WebSocket(BRIDGE_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[Bridge] Connected!')
        liveModeRef.current = true
        storeRef.current.setConnectionStatus('connected')
        setIsLive(true)
        stopMock()

        // Clear stale mock futures so UI doesn't show stale [MOCK] forever
        const store = storeRef.current
        if (store.futuresSource === 'MOCK') {
          store.updateFutures(null, '')
        }

        // Send current instrument to bridge
        ws.send(JSON.stringify({
          action: 'subscribe',
          instrument: store.instrument,
          expiry: store.selectedExpiry || null,
        }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          const store = storeRef.current
          store.incrementMessageCount()

          if (msg.type === 'snapshot') {
            flushBatch()
            if (msg.spotPrice) store.updateSpot(msg.spotPrice, msg.spotSource || 'BRIDGE')
            if (msg.futuresPrice) store.updateFutures(msg.futuresPrice, msg.futuresSource || 'BRIDGE')
            if (msg.expiryDate) store.setExpiryDate(msg.expiryDate)
            if (msg.availableExpiries) store.setAvailableExpiries(msg.availableExpiries)
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
          else if (msg.type === 'spot') store.updateSpot(msg.price, msg.source)
          else if (msg.type === 'futures') store.updateFutures(msg.price, msg.source)
          else if (msg.type === 'option') queueOptionUpdate(msg.strike, msg.optionType, msg.ltp, msg.oi, msg.volume)
        } catch (e) {
          console.error('[Bridge] Parse error:', e)
        }
      }

      ws.onerror = () => {
        storeRef.current.setConnectionStatus('error')
      }

      ws.onclose = () => {
        flushBatch()
        liveModeRef.current = false
        storeRef.current.setConnectionStatus('disconnected')
        wsRef.current = null
        setIsLive(false)
        startMock(instrumentRef.current)
        setTimeout(() => connectBridge(), 5000)
      }
    } catch (e) {
      console.error('[Bridge] Connection failed:', e)
    }
  }, [startMock, stopMock, flushBatch, queueOptionUpdate])

  // Watch for instrument changes
  useEffect(() => {
    const unsub = useMarketStore.subscribe((state: any, prevState: any) => {
      if (state.instrument !== prevState.instrument || state.selectedExpiry !== prevState.selectedExpiry) {
        console.log('[WebSocket] Instrument/expiry changed:', state.instrument, state.selectedExpiry)
        // Clear current data
        currentDataRef.current = {}
        pendingUpdatesRef.current = {}
        flushBatch()
        // Restart mock with new instrument
        stopMock()
        startMock(state.instrument)
        // Notify bridge if connected
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            action: 'subscribe',
            instrument: state.instrument,
            expiry: state.selectedExpiry || null,
          }))
        }
      }
    })
    return unsub
  }, [startMock, stopMock, flushBatch])

  useEffect(() => {
    startMock('NIFTY')
    const t = setTimeout(() => connectBridge(), 1000)
    return () => {
      clearTimeout(t)
      flushBatch()
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
      stopMock()
    }
  }, [startMock, stopMock, connectBridge, flushBatch])

  return { isLive, ready }
}
