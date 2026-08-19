import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Instrument, InstrumentConfig } from '@/types/market'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const INSTRUMENTS: Record<Instrument, InstrumentConfig> = {
  NIFTY: {
    name: 'NIFTY',
    displayName: 'NIFTY 50',
    strikeStep: 50,
    indexToken: '99926000',
    exchange: 'NSE',
    futuresExchange: 'NFO',
    lotSize: 75,
  },
  BANKNIFTY: {
    name: 'BANKNIFTY',
    displayName: 'BANK NIFTY',
    strikeStep: 100,
    indexToken: '99926009',
    exchange: 'NSE',
    futuresExchange: 'NFO',
    lotSize: 30,
  },
  FINNIFTY: {
    name: 'FINNIFTY',
    displayName: 'FIN NIFTY',
    strikeStep: 50,
    indexToken: '99926037',
    exchange: 'NSE',
    futuresExchange: 'NFO',
    lotSize: 65,
  },
  SENSEX: {
    name: 'SENSEX',
    displayName: 'SENSEX',
    strikeStep: 100,
    indexToken: '99919000',
    exchange: 'BSE',
    futuresExchange: 'BFO',
    lotSize: 20,
  },
  MIDCPNIFTY: {
    name: 'MIDCPNIFTY',
    displayName: 'MIDCAP NIFTY',
    strikeStep: 100,
    indexToken: '99926074',
    exchange: 'NSE',
    futuresExchange: 'NFO',
    lotSize: 120,
  },
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

export function getATMStrike(price: number | null, allStrikes: number[], strikeStep: number = 50): number | null {
  if (!price || allStrikes.length === 0) return null
  const rounded = Math.round(price / strikeStep) * strikeStep
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

export function calculateMaxPain(data: OptionData[]): { strike: number; totalPain: number } | null {
  if (data.length === 0) return null
  let minPain = Infinity
  let maxPainStrike = data[0]?.strike ?? 0

  for (const candidate of data) {
    let totalPain = 0
    for (const opt of data) {
      const cePain = opt.ce.oi * Math.max(0, candidate.strike - opt.strike)
      const pePain = opt.pe.oi * Math.max(0, opt.strike - candidate.strike)
      totalPain += cePain + pePain
    }
    if (totalPain < minPain) {
      minPain = totalPain
      maxPainStrike = candidate.strike
    }
  }
  return { strike: maxPainStrike, totalPain: minPain }
}

export function formatMaxPainValue(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(2)}B`
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`
  return val.toString()
}
