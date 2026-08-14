import { useMemo, useRef, useEffect, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useMarketStore } from '@/store/marketStore'
import { getATMStrike, getOIRanks, getMaxVolume, calculateMaxPain } from '@/lib/utils'
import OICell from './OICell'
import LTPCell from './LTPCell'
import StrikeCell from './StrikeCell'
import VolumeBar from './VolumeBar'
import ATMMarker from './ATMMarker'
import type { OptionData } from '@/types/market'
import gsap from 'gsap'
import { ChevronUp, ChevronDown, Target } from 'lucide-react'

interface TableRow {
  strike: number
  ceVol: number
  ceLtp: number
  ceOi: number
  cePrevOi: number
  ceChange: number
  peOi: number
  peLtp: number
  peVol: number
  pePrevOi: number
  peChange: number
  ceITM: boolean
  peITM: boolean
  isATM: boolean
  isMaxPain: boolean
}

export default function OptionChainTable() {
  // FIX: Use individual selectors to prevent re-render on every tick
  const optionData = useMarketStore((s) => s.optionData)
  const prevOptionData = useMarketStore((s) => s.prevOptionData)
  const spotPrice = useMarketStore((s) => s.spotPrice)
  const futuresPrice = useMarketStore((s) => s.futuresPrice)
  const settings = useMarketStore((s) => s.settings)
  const selectedStrike = useMarketStore((s) => s.selectedStrike)
  const strikeRange = useMarketStore((s) => s.strikeRange)
  const setSelectedStrike = useMarketStore((s) => s.setSelectedStrike)
  const setStrikeRange = useMarketStore((s) => s.setStrikeRange)

  const tableRef = useRef<HTMLDivElement>(null)
  const atmRowRef = useRef<HTMLTableRowElement>(null)

  const safeOptionData = optionData || []
  const safePrevOptionData = prevOptionData || []

  const allStrikes = useMemo(() => safeOptionData.map((d) => d.strike), [safeOptionData])
  const atmSpot = getATMStrike(spotPrice, allStrikes)
  const atmFutures = getATMStrike(futuresPrice, allStrikes)
  const effectiveATM = atmFutures || atmSpot

  const ceRanks = useMemo(() => getOIRanks(safeOptionData, 'CE'), [safeOptionData])
  const peRanks = useMemo(() => getOIRanks(safeOptionData, 'PE'), [safeOptionData])
  const maxVolume = useMemo(() => getMaxVolume(safeOptionData), [safeOptionData])
  const maxPain = useMemo(() => calculateMaxPain(safeOptionData), [safeOptionData])

  const displayData = useMemo(() => {
    if (safeOptionData.length === 0) return []
    const center = effectiveATM
    if (!center) {
      const mid = Math.floor(safeOptionData.length / 2)
      return safeOptionData.slice(Math.max(0, mid - strikeRange), Math.min(safeOptionData.length, mid + strikeRange + 1))
    }
    const centerIdx = safeOptionData.findIndex((d) => d.strike === center)
    if (centerIdx === -1) {
      const closest = safeOptionData.reduce((best, d, i) => 
        Math.abs(d.strike - center) < Math.abs(safeOptionData[best].strike - center) ? i : best, 0
      )
      return safeOptionData.slice(Math.max(0, closest - strikeRange), Math.min(safeOptionData.length, closest + strikeRange + 1))
    }
    return safeOptionData.slice(Math.max(0, centerIdx - strikeRange), Math.min(safeOptionData.length, centerIdx + strikeRange + 1))
  }, [safeOptionData, effectiveATM, strikeRange])

  useEffect(() => {
    if (!settings.autoScroll || !atmRowRef.current || !tableRef.current) return
    const container = tableRef.current
    const row = atmRowRef.current
    const containerHeight = container.clientHeight
    const rowTop = row.offsetTop
    const rowHeight = row.clientHeight
    container.scrollTo({ top: rowTop - containerHeight / 2 + rowHeight / 2, behavior: 'smooth' })
  }, [atmSpot, atmFutures, settings.autoScroll, displayData])

  useEffect(() => {
    if (!tableRef.current) return
    const rows = tableRef.current.querySelectorAll('tbody tr')
    if (rows.length === 0) return
    gsap.fromTo(rows, { opacity: 0.6 }, { opacity: 1, duration: 0.15, stagger: 0.008, ease: 'power2.out' })
  }, [displayData])

  const prevDataMap = useMemo(() => {
    const map = new Map<number, OptionData>()
    safePrevOptionData.forEach((d) => map.set(d.strike, d))
    return map
  }, [safePrevOptionData])

  const tableRows = useMemo<TableRow[]>(() => {
    const refPrice = spotPrice || effectiveATM || 22450
    return displayData.map((d) => {
      const prev = prevDataMap.get(d.strike)
      const isATM = d.strike === atmSpot || d.strike === atmFutures
      const isMaxPain = maxPain ? d.strike === maxPain.strike : false
      return {
        strike: d.strike,
        ceVol: d.ce?.volume ?? 0,
        ceLtp: d.ce?.ltp ?? 0,
        ceOi: d.ce?.oi ?? 0,
        cePrevOi: prev?.ce?.oi ?? d.ce?.oi ?? 0,
        ceChange: d.ce?.change ?? 0,
        peOi: d.pe?.oi ?? 0,
        peLtp: d.pe?.ltp ?? 0,
        peVol: d.pe?.volume ?? 0,
        pePrevOi: prev?.pe?.oi ?? d.pe?.oi ?? 0,
        peChange: d.pe?.change ?? 0,
        ceITM: d.strike < refPrice,
        peITM: d.strike > refPrice,
        isATM,
        isMaxPain,
      }
    })
  }, [displayData, prevDataMap, spotPrice, effectiveATM, atmSpot, atmFutures, maxPain])

  const getMarkers = useCallback((strike: number, isMaxPainRow: boolean): string[] => {
    const markers: string[] = []
    if (isMaxPainRow) markers.push('MAX PAIN')
    if (strike === atmSpot && strike === atmFutures) markers.push('ATM-BOTH')
    else {
      if (strike === atmSpot) markers.push('ATM-SPOT')
      if (strike === atmFutures) markers.push('ATM-FUT')
    }
    if (ceRanks.get(strike) === 1) markers.push('MAX CE')
    if (peRanks.get(strike) === 1) markers.push('MAX PE')
    return markers
  }, [atmSpot, atmFutures, ceRanks, peRanks])

  const columns = useMemo<ColumnDef<TableRow>[]>(() => [
    {
      id: 'ceVolume',
      header: () => <div className="text-center text-red-400/50 font-bold text-[10px] uppercase tracking-wider">VOL</div>,
      accessorKey: 'ceVol',
      cell: ({ row }) => (
        settings.volumeBarsEnabled 
          ? <VolumeBar value={row.original.ceVol} maxValue={maxVolume} side="CE" isITM={row.original.ceITM} />
          : <div className="text-center number-mono text-[9px] text-gray-500">{(row.original.ceVol / 1000).toFixed(1)}K</div>
      ),
      size: 75,
    },
    {
      id: 'ceLtp',
      header: () => <div className="text-center text-red-400/80 font-bold text-[10px] uppercase tracking-wider">LTP</div>,
      accessorKey: 'ceLtp',
      cell: ({ row }) => <LTPCell value={row.original.ceLtp} prevValue={row.original.ceLtp - row.original.ceChange * 0.001} side="CE" isITM={row.original.ceITM} />,
      size: 70,
    },
    {
      id: 'ceOi',
      header: () => <div className="text-center text-red-400/80 font-bold text-[10px] uppercase tracking-wider">OI</div>,
      accessorKey: 'ceOi',
      cell: ({ row }) => (
        <OICell value={row.original.ceOi} prevValue={row.original.cePrevOi} rank={ceRanks.get(row.original.strike)} side="CE" flashEnabled={settings.oiFlashEnabled} isITM={row.original.ceITM} />
      ),
      size: 90,
    },
    {
      id: 'strike',
      header: () => <div className="text-center text-white font-bold text-[10px] uppercase tracking-wider">Strike</div>,
      accessorKey: 'strike',
      cell: ({ row }) => {
        const strike = row.original.strike
        const markers = getMarkers(strike, row.original.isMaxPain)
        return (
          <div className="flex items-center justify-center gap-1">
            <StrikeCell strike={strike} isAtmSpot={strike === atmSpot} isAtmFutures={strike === atmFutures} isSelected={selectedStrike === strike} onClick={() => setSelectedStrike(selectedStrike === strike ? null : strike)} />
            <ATMMarker markers={markers} />
          </div>
        )
      },
      size: 110,
    },
    {
      id: 'peOi',
      header: () => <div className="text-center text-green-400/80 font-bold text-[10px] uppercase tracking-wider">OI</div>,
      accessorKey: 'peOi',
      cell: ({ row }) => (
        <OICell value={row.original.peOi} prevValue={row.original.pePrevOi} rank={peRanks.get(row.original.strike)} side="PE" flashEnabled={settings.oiFlashEnabled} isITM={row.original.peITM} />
      ),
      size: 90,
    },
    {
      id: 'peLtp',
      header: () => <div className="text-center text-green-400/80 font-bold text-[10px] uppercase tracking-wider">LTP</div>,
      accessorKey: 'peLtp',
      cell: ({ row }) => <LTPCell value={row.original.peLtp} prevValue={row.original.peLtp - row.original.peChange * 0.001} side="PE" isITM={row.original.peITM} />,
      size: 70,
    },
    {
      id: 'peVolume',
      header: () => <div className="text-center text-green-400/50 font-bold text-[10px] uppercase tracking-wider">VOL</div>,
      accessorKey: 'peVol',
      cell: ({ row }) => (
        settings.volumeBarsEnabled 
          ? <VolumeBar value={row.original.peVol} maxValue={maxVolume} side="PE" isITM={row.original.peITM} />
          : <div className="text-center number-mono text-[9px] text-gray-500">{(row.original.peVol / 1000).toFixed(1)}K</div>
      ),
      size: 75,
    },
  ], [atmSpot, atmFutures, ceRanks, peRanks, maxVolume, settings, selectedStrike, getMarkers, setSelectedStrike])

  const table = useReactTable({
    data: tableRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
  })

  if (safeOptionData.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <div className="animate-pulse text-gray-500 text-sm">Loading market data...</div>
      </div>
    )
  }

  return (
    <div className="glass-panel overflow-hidden border border-gray-800/50">
      {/* Range toggle header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800/50 bg-gray-900/40">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Strikes</span>
          <div className="flex items-center bg-gray-800/60 rounded-md overflow-hidden">
            <button
              onClick={() => setStrikeRange(10)}
              className={`px-2 py-0.5 text-[10px] font-mono transition-colors ${strikeRange === 10 ? 'bg-cyan-600/40 text-cyan-300' : 'text-gray-400 hover:text-gray-300'}`}
            >
              ±10
            </button>
            <button
              onClick={() => setStrikeRange(20)}
              className={`px-2 py-0.5 text-[10px] font-mono transition-colors ${strikeRange === 20 ? 'bg-cyan-600/40 text-cyan-300' : 'text-gray-400 hover:text-gray-300'}`}
            >
              ±20
            </button>
          </div>
          <span className="text-[10px] text-gray-600">{displayData.length} rows</span>
          {maxPain && (
            <div className="flex items-center gap-1 ml-2 px-1.5 py-px rounded bg-orange-500/10 border border-orange-500/20">
              <Target className="w-2.5 h-2.5 text-orange-400" />
              <span className="text-[9px] text-orange-400 font-mono">Max Pain: {maxPain.strike}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (atmRowRef.current && tableRef.current) {
                const container = tableRef.current
                const row = atmRowRef.current
                container.scrollTo({ top: row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2, behavior: 'smooth' })
              }
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-800/60 text-gray-400 hover:text-white text-[10px] transition-colors"
            title="Center on ATM"
          >
            <ChevronUp className="w-3 h-3" />
            <span className="font-mono">ATM</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div ref={tableRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
        <table className="w-full compact-table">
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-800/60">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="bg-[#0f1520] py-1.5" style={{ width: header.getSize() }}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isAtm = row.original.isATM
              const isMaxPainRow = row.original.isMaxPain
              return (
                <tr 
                  key={row.id} 
                  ref={isAtm ? atmRowRef : undefined} 
                  className={`border-b border-gray-800/20 transition-colors hover:bg-white/[0.03] ${isAtm ? 'bg-white/[0.04]' : ''} ${isMaxPainRow ? 'bg-orange-500/[0.06]' : ''}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="py-0">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-1.5 border-t border-gray-800/50 bg-gray-900/40 text-[10px] text-gray-500 text-center flex items-center justify-center gap-3">
        <span>ATM Spot: <span className="text-yellow-400 font-mono">{atmSpot || '—'}</span></span>
        <span className="text-gray-700">|</span>
        <span>ATM Fut: <span className="text-cyan-400 font-mono">{atmFutures || '—'}</span></span>
        <span className="text-gray-700">|</span>
        <span>Range: <span className="text-gray-300 font-mono">±{strikeRange}</span></span>
        {maxPain && (
          <>
            <span className="text-gray-700">|</span>
            <span className="text-orange-400">Max Pain: <span className="font-mono font-bold">{maxPain.strike}</span></span>
          </>
        )}
      </div>
    </div>
  )
}
