import { useRef, useEffect, memo } from 'react'
import gsap from 'gsap'
import { useMarketStore } from '@/store/marketStore'
import { getMaxVolume } from '@/lib/utils'

interface VolumeBarProps {
  value: number
  side: 'CE' | 'PE'
  isITM: boolean
}

function VolumeBar({ value, side, isITM }: VolumeBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const optionData = useMarketStore((s) => s.optionData)
  const maxVolume = optionData && optionData.length > 0 ? getMaxVolume(optionData) : 1

  const pct = maxVolume > 0 ? (value / maxVolume) * 100 : 0
  const prevPctRef = useRef(pct)

  useEffect(() => {
    if (!barRef.current) return
    if (Math.abs(pct - prevPctRef.current) < 0.5) return
    gsap.to(barRef.current, { width: `${Math.max(pct, 1)}%`, duration: 0.4, ease: 'power2.out' })
    prevPctRef.current = pct
  }, [pct])

  const colorClass = side === 'CE' ? 'bg-red-500/60 dark:bg-red-500/50' : 'bg-green-500/60 dark:bg-green-500/50'
  const bgTint = isITM
    ? (side === 'CE' ? 'bg-red-50 dark:bg-red-950/15' : 'bg-green-50 dark:bg-green-950/15')
    : 'bg-transparent'

  return (
    <div className={`flex items-center justify-center gap-1 px-1 py-px rounded ${bgTint}`}>
      <div className="w-16 h-1 bg-gray-300 dark:bg-gray-800/80 rounded-full overflow-hidden">
        <div ref={barRef} className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <span className="number-mono text-[9px] text-gray-500 w-10 text-right">
        {(value / 1000).toFixed(1)}K
      </span>
    </div>
  )
}

export default memo(VolumeBar, (prev, next) => {
  return prev.value === next.value && prev.side === next.side && prev.isITM === next.isITM
})
