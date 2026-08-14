import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { OptionData } from '@/types/market'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number, decimals = 0): string {
  if (num === 0) return '0'
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(decimals)
}

export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return '—'
  return price.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatOI(oi: number): string {
  if (oi >= 1_000_000) return `${(oi / 1_000_000).toFixed(2)}M`
  if (oi >= 1_000) return `${(oi / 1_000).toFixed(1)}K`
  return oi.toString()
}

export function getATMStrike(price: number | null, allStrikes: number[]): number | null {
  if (!price || allStrikes.length === 0) return null
  const rounded = Math.round(price / 50) * 50
  return allStrikes.reduce((closest, strike) =>
    Math.abs(strike - rounded) < Math.abs(closest - rounded) ? strike : closest
  )
}

export function getPremiumDiscount(
  spot: number | null,
  futures: number | null
): { diff: number; pct: number; label: string; isPremium: boolean } | null {
  if (!spot || !futures || spot === 0) return null
  const diff = futures - spot
  const pct = (diff / spot) * 100
  return {
    diff,
    pct,
    label: diff >= 0 ? 'PREMIUM' : 'DISCOUNT',
    isPremium: diff >= 0,
  }
}

export function getOIRanks(data: OptionData[], side: 'CE' | 'PE'): Map<number, number> {
  const sorted = [...data]
    .map((d) => ({ strike: d.strike, oi: side === 'CE' ? d.ce.oi : d.pe.oi }))
    .filter((d) => d.oi > 0)
    .sort((a, b) => b.oi - a.oi)

  const ranks = new Map<number, number>()
  sorted.slice(0, 3).forEach((item, idx) => {
    ranks.set(item.strike, idx + 1)
  })
  return ranks
}

export function getMaxVolume(data: OptionData[]): number {
  return Math.max(
    ...data.flatMap((d) => [d.ce.volume, d.pe.volume]),
    1
  )
}

// ==========================================
// MAX PAIN CALCULATION
// ==========================================
export interface MaxPainResult {
  strike: number
  totalPain: number
  cePain: number
  pePain: number
}

export function calculateMaxPain(data: OptionData[]): MaxPainResult | null {
  if (data.length === 0) return null

  const strikes = data.map((d) => d.strike).sort((a, b) => a - b)
  let minPain = Infinity
  let maxPainStrike = strikes[0]
  let minCePain = 0
  let minPePain = 0

  for (const expiryStrike of strikes) {
    let totalCePain = 0
    let totalPePain = 0

    for (const opt of data) {
      // Call pain: if expiryStrike > opt.strike, call writers pay (expiryStrike - strike) * OI
      if (expiryStrike > opt.strike) {
        totalCePain += (expiryStrike - opt.strike) * opt.ce.oi
      }
      // Put pain: if expiryStrike < opt.strike, put writers pay (strike - expiryStrike) * OI
      if (expiryStrike < opt.strike) {
        totalPePain += (opt.strike - expiryStrike) * opt.pe.oi
      }
    }

    const totalPain = totalCePain + totalPePain
    if (totalPain < minPain) {
      minPain = totalPain
      maxPainStrike = expiryStrike
      minCePain = totalCePain
      minPePain = totalPePain
    }
  }

  return {
    strike: maxPainStrike,
    totalPain: minPain,
    cePain: minCePain,
    pePain: minPePain,
  }
}

export function formatMaxPainValue(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toString()
}
