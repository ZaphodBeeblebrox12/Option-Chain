import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface VolumeBarProps {
  value: number
  maxValue: number
  side: 'CE' | 'PE'
  isITM: boolean
}

export default function VolumeBar({ value, maxValue, side, isITM }: VolumeBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0

  useEffect(() => {
    if (!barRef.current) return
    gsap.to(barRef.current, { width: `${Math.max(pct, 1)}%`, duration: 0.4, ease: 'power2.out' })
  }, [pct])

  const colorClass = side === 'CE' ? 'bg-red-500/50' : 'bg-green-500/50'
  const bgTint = isITM 
    ? (side === 'CE' ? 'bg-red-950/15' : 'bg-green-950/15')
    : 'bg-transparent'

  return (
    <div className={`flex items-center justify-center gap-1 px-1 py-px rounded ${bgTint}`}>
      <div className="w-16 h-1 bg-gray-800/80 rounded-full overflow-hidden">
        <div ref={barRef} className={`h-full rounded-full ${colorClass}`} style={{ width: '1%' }} />
      </div>
      <span className="number-mono text-[9px] text-gray-500 w-10 text-right">
        {(value / 1000).toFixed(1)}K
      </span>
    </div>
  )
}
