import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { formatOI } from '@/lib/utils'
import { Trophy, Medal, Award } from 'lucide-react'

interface OICellProps {
  value: number
  prevValue: number
  rank: number | undefined
  side: 'CE' | 'PE'
  flashEnabled: boolean
  isITM: boolean
}

export default function OICell({ value, prevValue, rank, side, flashEnabled, isITM }: OICellProps) {
  const cellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!cellRef.current || !flashEnabled || prevValue === undefined || value === prevValue) return
    const isUp = value > prevValue
    const color = isUp 
      ? (side === 'CE' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(34, 197, 94, 0.35)')
      : (side === 'CE' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)')
    gsap.fromTo(
      cellRef.current,
      { backgroundColor: color },
      { backgroundColor: 'transparent', duration: 0.35, ease: 'power2.out', clearProps: 'backgroundColor' }
    )
  }, [value, prevValue, flashEnabled, side])

  const isMax = rank === 1
  const isSecond = rank === 2
  const isThird = rank === 3

  let containerClass = ''
  let textClass = 'text-gray-400'

  if (isMax) {
    containerClass = side === 'CE' 
      ? 'bg-gradient-to-r from-red-700 to-red-600 text-white font-bold shadow-sm shadow-red-600/20' 
      : 'bg-gradient-to-r from-green-700 to-green-600 text-white font-bold shadow-sm shadow-green-600/20'
    textClass = 'text-white'
  } else if (isSecond) {
    containerClass = side === 'CE'
      ? 'bg-red-900/30 border border-red-500/25 text-red-300 font-semibold'
      : 'bg-green-900/30 border border-green-500/25 text-green-300 font-semibold'
    textClass = side === 'CE' ? 'text-red-300' : 'text-green-300'
  } else if (isThird) {
    containerClass = side === 'CE'
      ? 'bg-red-900/15 border border-red-500/15 text-red-400/70'
      : 'bg-green-900/15 border border-green-500/15 text-green-400/70'
    textClass = side === 'CE' ? 'text-red-400/70' : 'text-green-400/70'
  }

  // ITM/OTM background tint
  const bgTint = !isMax && !isSecond && !isThird
    ? (isITM 
        ? (side === 'CE' ? 'bg-red-950/20' : 'bg-green-950/20')
        : 'bg-transparent')
    : ''

  const icon = isMax ? <Trophy className="w-2.5 h-2.5 text-yellow-300 shrink-0" /> :
               isSecond ? <Medal className="w-2.5 h-2.5 text-yellow-400/80 shrink-0" /> :
               isThird ? <Award className="w-2.5 h-2.5 text-gray-400/60 shrink-0" /> : null

  return (
    <div ref={cellRef} className={`relative px-1 py-0.5 rounded ${bgTint}`}>
      <div className={`flex items-center justify-center gap-1 px-1.5 py-0.5 rounded ${containerClass}`}>
        {icon}
        <span className={`number-mono text-[11px] ${textClass}`}>
          {formatOI(value)}
        </span>
      </div>
    </div>
  )
}
