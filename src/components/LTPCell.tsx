import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface LTPCellProps {
  value: number
  prevValue: number
  side: 'CE' | 'PE'
  isITM: boolean
}

export default function LTPCell({ value, prevValue, side, isITM }: LTPCellProps) {
  const cellRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!cellRef.current || prevValue === undefined || value === prevValue) return
    const isUp = value > prevValue
    const color = isUp 
      ? (side === 'CE' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)')
      : (side === 'CE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)')
    gsap.fromTo(cellRef.current, { backgroundColor: color }, { backgroundColor: 'transparent', duration: 0.3, ease: 'power2.out', clearProps: 'backgroundColor' })
  }, [value, prevValue, side])

  useEffect(() => {
    if (!valueRef.current || prevValue === undefined || value === prevValue) return
    gsap.fromTo(valueRef.current, { scale: 1.08 }, { scale: 1, duration: 0.2, ease: 'power2.out' })
  }, [value, prevValue])

  const change = prevValue !== undefined ? value - prevValue : 0
  const isUp = change > 0
  const isDown = change < 0
  const colorClass = side === 'CE' 
    ? (isUp ? 'text-red-400' : isDown ? 'text-green-400' : 'text-cyan-400')
    : (isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-green-400')

  // ITM/OTM tint
  const bgTint = isITM 
    ? (side === 'CE' ? 'bg-red-950/15' : 'bg-green-950/15')
    : 'bg-transparent'

  return (
    <div ref={cellRef} className={`px-1 py-0.5 rounded ${bgTint}`}>
      <div className="flex items-center justify-center gap-0.5">
        {isUp && <ArrowUp className="w-2.5 h-2.5 text-green-400 shrink-0" />}
        {isDown && <ArrowDown className="w-2.5 h-2.5 text-red-400 shrink-0" />}
        <span ref={valueRef} className={`number-mono text-[11px] font-semibold ${colorClass}`}>
          {value.toFixed(2)}
        </span>
      </div>
    </div>
  )
}
