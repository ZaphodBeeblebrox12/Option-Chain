import { useMemo } from 'react'
import { useMarketStore } from '@/store/marketStore'
import { useGSAPNumberRoll } from '@/hooks/useGSAPFlash'
import { getPremiumDiscount, calculateMaxPain, formatMaxPainValue } from '@/lib/utils'
import { TrendingUp, TrendingDown, Activity, Radio, Clock, Target } from 'lucide-react'
import { motion } from 'framer-motion'

export default function MarketHeader() {
  const { spotPrice, futuresPrice, spotSource, futuresSource, expiryDate, messageCount, connectionStatus, optionData } = useMarketStore()

  const spotRef = useGSAPNumberRoll(spotPrice, 2)
  const futuresRef = useGSAPNumberRoll(futuresPrice, 2)

  const premium = getPremiumDiscount(spotPrice, futuresPrice)
  const maxPain = useMemo(() => calculateMaxPain(optionData || []), [optionData])
  const now = new Date().toLocaleTimeString('en-IN', { hour12: false })

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="glass-panel px-3 py-2 mb-1.5 sticky top-0 z-50 border border-gray-800/60"
    >
      <div className="flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-yellow-500" />
            <h1 className="text-sm font-bold tracking-tight">
              NIFTY <span className="text-gray-500 font-normal text-xs">{expiryDate || 'LIVE'}</span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <Radio className={`w-2.5 h-2.5 ${connectionStatus === 'connected' ? 'text-green-400' : 'text-yellow-500'}`} />
            <span className="font-mono uppercase">{connectionStatus}</span>
            <span className="text-gray-700">|</span>
            <span className="font-mono">{messageCount.toLocaleString()} ticks</span>
          </div>
        </div>

        {/* Center: Max Pain */}
        {maxPain && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-orange-500/10 border border-orange-500/20">
            <Target className="w-3.5 h-3.5 text-orange-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-orange-400/80 uppercase font-semibold tracking-wider">Max Pain</span>
              <span className="font-bold font-mono text-orange-300 text-sm">{maxPain.strike}</span>
              <span className="text-[9px] text-gray-500 font-mono">({formatMaxPainValue(maxPain.totalPain)})</span>
            </div>
          </div>
        )}

        {/* Right */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase">Spot</span>
            <span ref={spotRef} className="font-bold font-mono text-yellow-400 text-glow-yellow text-sm">
              {spotPrice?.toFixed(2) || '—'}
            </span>
            <span className="text-[9px] text-gray-600 font-mono">{spotSource ? `[${spotSource}]` : ''}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 uppercase">Fut</span>
            <span ref={futuresRef} className="font-bold font-mono text-cyan-400 text-glow-cyan text-sm">
              {futuresPrice?.toFixed(2) || '—'}
            </span>
            <span className="text-[9px] text-gray-600 font-mono">{futuresSource ? `[${futuresSource}]` : ''}</span>
          </div>

          {premium && (
            <div className="flex items-center gap-1.5">
              {premium.isPremium ? <TrendingUp className="w-3 h-3 text-green-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
              <span className={`font-bold font-mono text-sm ${premium.isPremium ? 'text-green-400' : 'text-red-400'}`}>
                {premium.diff >= 0 ? '+' : ''}{premium.diff.toFixed(2)}
              </span>
              <span className="text-[9px] text-gray-500 font-mono">
                ({premium.pct >= 0 ? '+' : ''}{premium.pct.toFixed(3)}%)
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-px rounded ${premium.isPremium ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                {premium.label}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1 text-gray-400">
            <Clock className="w-3 h-3" />
            <span className="font-mono font-semibold text-[11px]">{now}</span>
          </div>
        </div>
      </div>
    </motion.header>
  )
}
