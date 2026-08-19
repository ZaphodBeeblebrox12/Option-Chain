import type { Instrument, OptionData } from '@/types/market'
import { INSTRUMENTS } from '@/lib/utils'

const BASE_PRICES: Record<Instrument, number> = {
  NIFTY: 22450,
  BANKNIFTY: 47800,
  FINNIFTY: 23500,
  SENSEX: 73800,
  MIDCPNIFTY: 13200,
}

function randomWalk(current: number, volatility: number, min: number, max: number): number {
  const change = (Math.random() - 0.5) * volatility
  const next = current + change
  return Math.max(min, Math.min(max, next))
}

function generateInitialOption(strike: number, spot: number, strikeStep: number): OptionData {
  const distance = Math.abs(strike - spot)
  const isITM = strike < spot

  const ceIntrinsic = Math.max(0, spot - strike)
  const ceTimeValue = Math.max(5, 150 - distance * 0.8 + Math.random() * 30)
  const ceLtp = Math.max(1, ceIntrinsic + ceTimeValue)
  const ceOI = Math.floor(50000 + Math.random() * 800000)

  const peIntrinsic = Math.max(0, strike - spot)
  const peTimeValue = Math.max(5, 150 - distance * 0.8 + Math.random() * 30)
  const peLtp = Math.max(1, peIntrinsic + peTimeValue)
  const peOI = Math.floor(50000 + Math.random() * 800000)

  return {
    strike,
    ce: {
      ltp: Math.round(ceLtp * 100) / 100,
      oi: ceOI,
      volume: Math.floor(ceOI * 0.1 + Math.random() * 5000),
      change: 0,
      prevOi: ceOI,
    },
    pe: {
      ltp: Math.round(peLtp * 100) / 100,
      oi: peOI,
      volume: Math.floor(peOI * 0.1 + Math.random() * 5000),
      change: 0,
      prevOi: peOI,
    },
    lastUpdate: Date.now(),
  }
}

export function generateMockData(instrument: Instrument = 'NIFTY'): OptionData[] {
  const config = INSTRUMENTS[instrument]
  const baseSpot = BASE_PRICES[instrument]
  const strikeStep = config.strikeStep
  const numStrikes = 41
  const startStrike = baseSpot - Math.floor(numStrikes / 2) * strikeStep

  const strikes = Array.from({ length: numStrikes }, (_, i) => startStrike + i * strikeStep)
  return strikes.map((strike) => generateInitialOption(strike, baseSpot, strikeStep))
}

export function generateNextTick(current: OptionData[], instrument: Instrument = 'NIFTY'): { 
  data: OptionData[] 
  spotPrice: number 
  futuresPrice: number 
} {
  const baseSpot = BASE_PRICES[instrument]
  const spotNoise = (Math.random() - 0.5) * 8
  const newSpot = baseSpot + spotNoise + Math.sin(Date.now() / 30000) * 15
  const newFutures = newSpot + 35 + Math.sin(Date.now() / 45000) * 8

  const updated = current.map((opt) => {
    const distance = Math.abs(opt.strike - newSpot)

    const ceOiChange = Math.floor((Math.random() - 0.48) * 1500)
    const ceLtpChange = (Math.random() - 0.5) * (distance < 100 ? 2.5 : 0.8)
    const ceVolumeChange = Math.floor(Math.random() * 200)

    const peOiChange = Math.floor((Math.random() - 0.48) * 1500)
    const peLtpChange = (Math.random() - 0.5) * (distance < 100 ? 2.5 : 0.8)
    const peVolumeChange = Math.floor(Math.random() * 200)

    return {
      strike: opt.strike,
      ce: {
        ltp: Math.max(0.05, Math.round((opt.ce.ltp + ceLtpChange) * 100) / 100),
        oi: Math.max(0, opt.ce.oi + ceOiChange),
        volume: opt.ce.volume + ceVolumeChange,
        change: ceOiChange,
        prevOi: opt.ce.oi,
      },
      pe: {
        ltp: Math.max(0.05, Math.round((opt.pe.ltp + peLtpChange) * 100) / 100),
        oi: Math.max(0, opt.pe.oi + peOiChange),
        volume: opt.pe.volume + peVolumeChange,
        change: peOiChange,
        prevOi: opt.pe.oi,
      },
      lastUpdate: Date.now(),
    }
  })

  return {
    data: updated,
    spotPrice: Math.round(newSpot * 100) / 100,
    futuresPrice: Math.round(newFutures * 100) / 100,
  }
}
