export interface OptionData {
  strike: number
  ce: {
    ltp: number
    oi: number
    volume: number
    change: number
    prevOi: number
  }
  pe: {
    ltp: number
    oi: number
    volume: number
    change: number
    prevOi: number
  }
  lastUpdate: number
}

export interface MarketState {
  spotPrice: number | null
  futuresPrice: number | null
  spotSource: string
  futuresSource: string
  expiryDate: string
  optionData: OptionData[]
  prevOptionData: OptionData[]
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastUpdate: number
  messageCount: number
  selectedStrike: number | null
  strikeRange: number
  settings: {
    autoScroll: boolean
    soundAlerts: boolean
    oiFlashEnabled: boolean
    volumeBarsEnabled: boolean
    darkMode: boolean
  }
}

export interface OIRank {
  strike: number
  rank: number
  value: number
}

export type OptionSide = 'CE' | 'PE'
