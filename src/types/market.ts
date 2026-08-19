export type Instrument = 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'SENSEX' | 'MIDCPNIFTY'

export interface InstrumentConfig {
  name: Instrument
  displayName: string
  strikeStep: number
  indexToken: string
  exchange: 'NSE' | 'BSE'
  futuresExchange: 'NFO' | 'BFO'
  lotSize: number
}

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
  instrument: Instrument
  availableExpiries: string[]
  selectedExpiry: string
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
