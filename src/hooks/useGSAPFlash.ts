import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export function useGSAPFlash(
  value: number,
  prevValue: number | undefined,
  enabled: boolean = true
) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled || !ref.current || prevValue === undefined) return
    if (value === prevValue) return

    const el = ref.current
    const isUp = value > prevValue
    const color = isUp ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'

    gsap.fromTo(
      el,
      { backgroundColor: color },
      {
        backgroundColor: 'transparent',
        duration: 0.3,
        ease: 'power2.out',
        clearProps: 'backgroundColor',
      }
    )
  }, [value, prevValue, enabled])

  return ref
}

export function useGSAPPulse(
  isActive: boolean,
  color: string = 'rgba(234, 179, 8, 0.3)'
) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isActive || !ref.current) return

    const el = ref.current
    gsap.to(el, {
      boxShadow: `0 0 20px ${color}`,
      duration: 0.5,
      yoyo: true,
      repeat: 1,
      ease: 'sine.inOut',
    })
  }, [isActive, color])

  return ref
}

export function useGSAPNumberRoll(
  value: number | null,
  decimals: number = 2
) {
  const ref = useRef<HTMLSpanElement>(null)
  const prevValueRef = useRef<number | null>(null)

  useEffect(() => {
    if (!ref.current || value === null) return
    const prev = prevValueRef.current
    prevValueRef.current = value

    if (prev === null || prev === value) {
      ref.current.textContent = value.toFixed(decimals)
      return
    }

    const obj = { val: prev }
    gsap.to(obj, {
      val: value,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = obj.val.toFixed(decimals)
        }
      },
    })
  }, [value, decimals])

  return ref
}
