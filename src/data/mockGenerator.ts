import type { OptionData } from '@/types/market'

const BASE_SPOT = 22450
const STRIKES = Array.from({ length: 41 }, (_, i) => 22250 + i * 50)

// Realistic OI distribution: higher near ATM, tapering off
function generateOI(strike: number, spot: number, side: 'CE' | 'PE', rank: number): number {
  const distance = Math.abs(strike - spot)
  const baseOI = 500000 - distance * 2000  // Higher OI near ATM
  const noise = (Math.random() - 0.5) * 300000
  const rankBoost = rank === 1 ? 200000 : rank === 2 ? 100000 : rank === 3 ? 50000 : 0
  return Math.max(50000, Math.floor(baseOI + noise + rankBoost))
}

function generateInitialOption(strike: number, spot: number, ceRank: number, peRank: number): OptionData {
  const distance = Math.abs(strike - spot)
  const isITM = strike < spot

  const ceIntrinsic = Math.max(0, spot - strike)
  const ceTimeValue = Math.max(5, 180 - distance * 0.9 + Math.random() * 25)
  const ceLtp = Math.max(0.5, ceIntrinsic + ceTimeValue)
  const ceOI = generateOI(strike, spot, 'CE', ceRank)

  const peIntrinsic = Math.max(0, strike - spot)
  const peTimeValue = Math.max(5, 180 - distance * 0.9 + Math.random() * 25)
  const peLtp = Math.max(0.5, peIntrinsic + peTimeValue)
  const peOI = generateOI(strike, spot, 'PE', peRank)

  return {
    strike,
    ce: {
      ltp: Math.round(ceLtp * 100) / 100,
      oi: ceOI,
      volume: Math.floor(ceOI * 0.08 + Math.random() * 3000),
      change: 0,
      prevOi: ceOI,
    },
    pe: {
      ltp: Math.round(peLtp * 100) / 100,
      oi: peOI,
      volume: Math.floor(peOI * 0.08 + Math.random() * 3000),
      change: 0,
      prevOi: peOI,
    },
    lastUpdate: Date.now(),
  }
}

export function generateMockData(): OptionData[] {
  // Assign ranks: 1st, 2nd, 3rd highest OI at specific strikes
  const ceRanks: Record<number, number> = {}
  const peRanks: Record<number, number> = {}

  // Pick 3 strikes for CE ranks (near ATM)
  const ceRankStrikes = [22350, 22450, 22550]
  ceRankStrikes.forEach((s, i) => ceRanks[s] = i + 1)

  // Pick 3 strikes for PE ranks (near ATM)
  const peRankStrikes = [22400, 22500, 22600]
  peRankStrikes.forEach((s, i) => peRanks[s] = i + 1)

  return STRIKES.map((strike) => generateInitialOption(strike, BASE_SPOT, ceRanks[strike] || 0, peRanks[strike] || 0))
}

export function generateNextTick(current: OptionData[]): { 
  data: OptionData[] 
  spotPrice: number 
  futuresPrice: number 
} {
  const spotNoise = (Math.random() - 0.5) * 6
  const trend = Math.sin(Date.now() / 20000) * 8
  const newSpot = BASE_SPOT + spotNoise + trend
  const newFutures = newSpot + 32 + Math.sin(Date.now() / 35000) * 5

  const updated = current.map((opt) => {
    const distance = Math.abs(opt.strike - newSpot)

    const ceOiChange = Math.floor((Math.random() - 0.49) * 1200)
    const ceLtpChange = (Math.random() - 0.5) * (distance < 150 ? 1.8 : 0.5)
    const ceVolumeChange = Math.floor(Math.random() * 150)

    const peOiChange = Math.floor((Math.random() - 0.49) * 1200)
    const peLtpChange = (Math.random() - 0.5) * (distance < 150 ? 1.8 : 0.5)
    const peVolumeChange = Math.floor(Math.random() * 150)

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
