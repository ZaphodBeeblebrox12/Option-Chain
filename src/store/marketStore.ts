import { create } from 'zustand'
import { type OptionData, type MarketState, type Instrument } from '@/types/market'

interface MarketStore extends MarketState {
  updateSpot: (price: number, source: string) => void
  updateFutures: (price: number, source: string) => void
  updateOptionData: (data: OptionData[]) => void
  setConnectionStatus: (status: MarketState['connectionStatus']) => void
  setSelectedStrike: (strike: number | null) => void
  toggleSetting: (key: keyof MarketState['settings']) => void
  incrementMessageCount: () => void
  setExpiryDate: (date: string) => void
  setInstrument: (instrument: Instrument) => void
  setAvailableExpiries: (expiries: string[]) => void
  setSelectedExpiry: (expiry: string) => void
  setStrikeRange: (range: number) => void
}

export const useMarketStore = create<MarketStore>((set) => ({
  spotPrice: null,
  futuresPrice: null,
  spotSource: '',
  futuresSource: '',
  expiryDate: '',
  optionData: [],
  prevOptionData: [],
  connectionStatus: 'connecting',
  lastUpdate: 0,
  messageCount: 0,
  selectedStrike: null,
  instrument: 'NIFTY',
  availableExpiries: [],
  selectedExpiry: '',
  strikeRange: 10,
  settings: {
    autoScroll: true,
    soundAlerts: false,
    oiFlashEnabled: true,
    volumeBarsEnabled: true,
    darkMode: true,
  },

  updateSpot: (price, source) =>
    set({ spotPrice: price, spotSource: source, lastUpdate: Date.now() }),

  updateFutures: (price, source) =>
    set({ futuresPrice: price, futuresSource: source, lastUpdate: Date.now() }),

  updateOptionData: (data) =>
    set((state) => ({
      prevOptionData: state.optionData,
      optionData: data,
      lastUpdate: Date.now(),
    })),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setSelectedStrike: (strike) => set({ selectedStrike: strike }),

  toggleSetting: (key) =>
    set((state) => {
      const newSettings = { ...state.settings, [key]: !state.settings[key] }
      // Apply dark mode to document immediately
      if (key === 'darkMode') {
        if (newSettings.darkMode) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
      return { settings: newSettings }
    }),

  incrementMessageCount: () =>
    set((state) => ({ messageCount: state.messageCount + 1 })),

  setExpiryDate: (date) => set({ expiryDate: date }),

  setInstrument: (instrument) =>
    set({
      instrument,
      optionData: [],
      prevOptionData: [],
      spotPrice: null,
      futuresPrice: null,
      messageCount: 0,
      selectedExpiry: '',
      availableExpiries: [],
    }),

  setAvailableExpiries: (expiries) => set({ availableExpiries: expiries }),

  setSelectedExpiry: (expiry) => set({ selectedExpiry: expiry }),

  setStrikeRange: (range) => set({ strikeRange: range }),
}))
