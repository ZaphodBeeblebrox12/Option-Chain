import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { Crosshair } from 'lucide-react'

interface StrikeCellProps {
  strike: number
  isAtmSpot: boolean
  isAtmFutures: boolean
  isSelected: boolean
  onClick: () => void
}

export default function StrikeCell({ strike, isAtmSpot, isAtmFutures, isSelected, onClick }: StrikeCellProps) {
  const cellRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLDivElement>(null)
  const isBoth = isAtmSpot && isAtmFutures

  useEffect(() => {
    if (!cellRef.current) return
    if (isBoth || isAtmSpot || isAtmFutures) {
      gsap.fromTo(cellRef.current, { scale: 1.08 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.5)' })
    }
  }, [isAtmSpot, isAtmFutures, isBoth])

  useEffect(() => {
    if (!iconRef.current || !isBoth) return
    gsap.to(iconRef.current, { rotation: 360, duration: 3, ease: 'none', repeat: -1 })
    return () => { gsap.killTweensOf(iconRef.current) }
  }, [isBoth])

  let bgClass = 'bg-gray-800/40 hover:bg-gray-700/50'
  let textClass = 'text-gray-400'
  let borderClass = 'border-transparent'
  let shadowClass = ''

  if (isBoth) {
    bgClass = 'bg-gradient-to-br from-purple-500 to-purple-600'
    textClass = 'text-white font-bold'
    borderClass = 'border-purple-400/50'
    shadowClass = 'shadow-lg shadow-purple-500/25'
  } else if (isAtmSpot) {
    bgClass = 'bg-gradient-to-br from-yellow-400 to-yellow-500'
    textClass = 'text-gray-900 font-bold'
    borderClass = 'border-yellow-400/50'
    shadowClass = 'shadow-lg shadow-yellow-500/25'
  } else if (isAtmFutures) {
    bgClass = 'bg-gradient-to-br from-cyan-400 to-cyan-500'
    textClass = 'text-gray-900 font-bold'
    borderClass = 'border-cyan-400/50'
    shadowClass = 'shadow-lg shadow-cyan-500/25'
  }

  if (isSelected && !isAtmSpot && !isAtmFutures) {
    borderClass = 'border-white/20'
    bgClass = 'bg-white/5'
  }

  return (
    <div
      ref={cellRef}
      onClick={onClick}
      className={`relative px-2 py-0.5 rounded-md border cursor-pointer transition-all duration-200 hover:scale-105 ${bgClass} ${textClass} ${borderClass} ${shadowClass}`}
    >
      <div className="flex items-center justify-center gap-0.5">
        {isBoth && <div ref={iconRef}><Crosshair className="w-2.5 h-2.5" /></div>}
        <span className="number-mono text-[11px]">{strike}</span>
      </div>
    </div>
  )
}
