import { useRef, useEffect, memo } from 'react'
import gsap from 'gsap'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface LTPCellProps {
  value: number
  side: 'CE' | 'PE'
  isITM: boolean
}

function LTPCell({ value, side, isITM }: LTPCellProps) {
  const flashRef = useRef<HTMLDivElement>(null)
  const valueRef = useRef<HTMLSpanElement>(null)
  const prevValueRef = useRef(value)

  useEffect(() => {
    if (!flashRef.current) return
    const prevValue = prevValueRef.current
    if (value === prevValue) return

    const isUp = value > prevValue
    const color = isUp
      ? (side === 'CE' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(34, 197, 94, 0.25)')
      : (side === 'CE' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)')

    gsap.killTweensOf(flashRef.current)
    gsap.fromTo(flashRef.current, { opacity: 1, backgroundColor: color }, { opacity: 0, backgroundColor: 'transparent', duration: 0.3, ease: 'power2.out' })
  }, [value, side])

  useEffect(() => {
    if (!valueRef.current) return
    const prevValue = prevValueRef.current
    if (value === prevValue) return
    gsap.fromTo(valueRef.current, { scale: 1.08 }, { scale: 1, duration: 0.2, ease: 'power2.out' })
    prevValueRef.current = value
  }, [value])

  const prevValue = prevValueRef.current
  const change = value - prevValue
  const isUp = change > 0
  const isDown = change < 0
  const colorClass = side === 'CE'
    ? (isUp ? 'text-red-600 dark:text-red-400' : isDown ? 'text-green-600 dark:text-green-400' : 'text-cyan-600 dark:text-cyan-400')
    : (isUp ? 'text-green-600 dark:text-green-400' : isDown ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')

  const bgTint = isITM
    ? (side === 'CE' ? 'bg-red-50 dark:bg-red-950/15' : 'bg-green-50 dark:bg-green-950/15')
    : 'bg-transparent'

  return (
    <div className={`relative px-1 py-0.5 rounded ${bgTint}`}>
      <div ref={flashRef} className="absolute inset-0 rounded pointer-events-none opacity-0" />
      <div className="relative flex items-center justify-center gap-0.5">
        {isUp && <ArrowUp className="w-2.5 h-2.5 text-green-600 dark:text-green-400 shrink-0" />}
        {isDown && <ArrowDown className="w-2.5 h-2.5 text-red-600 dark:text-red-400 shrink-0" />}
        <span ref={valueRef} className={`number-mono text-[11px] font-semibold ${colorClass}`}>
          {value.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

export default memo(LTPCell, (prev, next) => {
  return prev.value === next.value && prev.side === next.side && prev.isITM === next.isITM
})
