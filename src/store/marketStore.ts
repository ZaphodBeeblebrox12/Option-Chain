import { create } from 'zustand'
import { type OptionData, type MarketState } from '@/types/market'

interface MarketStore extends MarketState {
  updateSpot: (price: number, source: string) => void
  updateFutures: (price: number, source: string) => void
  updateOptionData: (data: OptionData[]) => void
  setConnectionStatus: (status: MarketState['connectionStatus']) => void
  setSelectedStrike: (strike: number | null) => void
  toggleSetting: (key: keyof MarketState['settings']) => void
  incrementMessageCount: () => void
  setExpiryDate: (date: string) => void
  setStrikeRange: (range: number) => void
}

export const useMarketStore = create<MarketStore>((set, get) => ({
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
    set((state) => ({
      settings: { ...state.settings, [key]: !state.settings[key] },
    })),

  incrementMessageCount: () =>
    set((state) => ({ messageCount: state.messageCount + 1 })),

  setExpiryDate: (date) => set({ expiryDate: date }),

  setStrikeRange: (range) => set({ strikeRange: range }),
}))
