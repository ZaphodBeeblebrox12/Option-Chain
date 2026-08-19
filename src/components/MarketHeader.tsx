import { useMemo } from 'react'
import { useMarketStore } from '@/store/marketStore'
import { useGSAPNumberRoll } from '@/hooks/useGSAPFlash'
import { getPremiumDiscount, calculateMaxPain, formatMaxPainValue, INSTRUMENTS } from '@/lib/utils'
import { TrendingUp, TrendingDown, Activity, Radio, Clock, Target, ChevronDown } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Instrument } from '@/types/market'

export default function MarketHeader() {
  const spotPrice = useMarketStore((s) => s.spotPrice)
  const futuresPrice = useMarketStore((s) => s.futuresPrice)
  const spotSource = useMarketStore((s) => s.spotSource)
  const futuresSource = useMarketStore((s) => s.futuresSource)
  const expiryDate = useMarketStore((s) => s.expiryDate)
  const messageCount = useMarketStore((s) => s.messageCount)
  const connectionStatus = useMarketStore((s) => s.connectionStatus)
  const optionData = useMarketStore((s) => s.optionData)
  const instrument = useMarketStore((s) => s.instrument)
  const availableExpiries = useMarketStore((s) => s.availableExpiries)
  const selectedExpiry = useMarketStore((s) => s.selectedExpiry)
  const setInstrument = useMarketStore((s) => s.setInstrument)
  const setSelectedExpiry = useMarketStore((s) => s.setSelectedExpiry)

  const spotRef = useGSAPNumberRoll(spotPrice, 2)
  const futuresRef = useGSAPNumberRoll(futuresPrice, 2)

  const premium = getPremiumDiscount(spotPrice, futuresPrice)
  const maxPain = useMemo(() => calculateMaxPain(optionData || []), [optionData])
  const now = new Date().toLocaleTimeString('en-IN', { hour12: false })

  const config = INSTRUMENTS[instrument]

  const handleInstrumentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setInstrument(e.target.value as Instrument)
  }

  const handleExpiryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedExpiry(e.target.value)
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="glass-panel px-3 py-2 mb-1.5 sticky top-0 z-50"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
            <div className="relative">
              <select
                value={instrument}
                onChange={handleInstrumentChange}
                className="appearance-none bg-white dark:bg-gray-800/60 border border-gray-300 dark:border-gray-700/50 rounded-md pl-2 pr-6 py-1 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {Object.entries(INSTRUMENTS).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.displayName}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="relative">
            <select
              value={selectedExpiry || expiryDate}
              onChange={handleExpiryChange}
              className="appearance-none bg-white dark:bg-gray-800/40 border border-gray-300 dark:border-gray-700/30 rounded-md pl-2 pr-6 py-1 text-xs font-mono text-gray-700 dark:text-gray-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              {availableExpiries.length > 0 ? (
                availableExpiries.map((exp) => (
                  <option key={exp} value={exp}>{exp}</option>
                ))
              ) : (
                <option value={expiryDate || ''}>{expiryDate || 'Loading...'}</option>
              )}
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <Radio className={`w-2.5 h-2.5 ${connectionStatus === 'connected' ? 'text-green-500 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-500'}`} />
            <span className="font-mono uppercase">{connectionStatus}</span>
            <span className="text-gray-300 dark:text-gray-700">|</span>
            <span className="font-mono">{messageCount.toLocaleString()} ticks</span>
          </div>
        </div>

        {maxPain && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-orange-500/10 border border-orange-500/20">
            <Target className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-orange-600 dark:text-orange-400/80 uppercase font-semibold tracking-wider">Max Pain</span>
              <span className="font-bold font-mono text-orange-700 dark:text-orange-300 text-sm">{maxPain.strike}</span>
              <span className="text-[9px] text-gray-500 font-mono">({formatMaxPainValue(maxPain.totalPain)})</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase">Spot</span>
            <span ref={spotRef} className="font-bold font-mono text-yellow-700 dark:text-yellow-400 text-glow-yellow text-sm">
              {spotPrice?.toFixed(2) || '—'}
            </span>
            <span className="text-[9px] text-gray-400 font-mono">{spotSource ? `[${spotSource}]` : ''}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase">Fut</span>
            <span ref={futuresRef} className="font-bold font-mono text-cyan-700 dark:text-cyan-400 text-glow-cyan text-sm">
              {futuresPrice?.toFixed(2) || '—'}
            </span>
            <span className="text-[9px] text-gray-400 font-mono">{futuresSource ? `[${futuresSource}]` : ''}</span>
          </div>

          {premium && (
            <div className="flex items-center gap-1.5">
              {premium.isPremium ? <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" /> : <TrendingDown className="w-3 h-3 text-red-600 dark:text-red-400" />}
              <span className={`font-bold font-mono text-sm ${premium.isPremium ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {premium.diff >= 0 ? '+' : ''}{premium.diff.toFixed(2)}
              </span>
              <span className="text-[9px] text-gray-500 font-mono">
                ({premium.pct >= 0 ? '+' : ''}{premium.pct.toFixed(3)}%)
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-px rounded ${premium.isPremium ? 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20' : 'bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/20'}`}>
                {premium.label}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <Clock className="w-3 h-3" />
            <span className="font-mono font-semibold text-[11px]">{now}</span>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
