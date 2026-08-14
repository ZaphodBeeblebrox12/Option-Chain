import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, X, Volume2, Zap, ScrollText, BarChart3, Moon } from 'lucide-react'
import { useMarketStore } from '@/store/marketStore'

export default function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const { settings, toggleSetting } = useMarketStore()

  const settingItems = [
    { key: 'oiFlashEnabled' as const, label: 'OI Flash Animation', icon: Zap, description: 'Flash cells on OI change' },
    { key: 'volumeBarsEnabled' as const, label: 'Volume Bars', icon: BarChart3, description: 'Show relative volume bars' },
    { key: 'autoScroll' as const, label: 'Auto Scroll', icon: ScrollText, description: 'Keep ATM in view' },
    { key: 'soundAlerts' as const, label: 'Sound Alerts', icon: Volume2, description: 'Audio on significant moves' },
    { key: 'darkMode' as const, label: 'Dark Mode', icon: Moon, description: 'Toggle dark/light theme' },
  ]

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-lg bg-market-card border border-market-border hover:border-gray-600 transition-colors"
      >
        <Settings className="w-5 h-5 text-gray-400" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-80 bg-market-card border-l border-market-border z-50 shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-market-border">
                <h2 className="text-lg font-semibold">Settings</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {settingItems.map((item) => {
                  const Icon = item.icon
                  const isEnabled = settings[item.key]
                  return (
                    <button
                      key={item.key}
                      onClick={() => toggleSetting(item.key)}
                      className={`
                        w-full flex items-center gap-3 p-3 rounded-lg border transition-all
                        ${isEnabled 
                          ? 'border-market-futures/50 bg-cyan-500/10' 
                          : 'border-market-border hover:border-gray-600'
                        }
                      `}
                    >
                      <Icon className={`w-5 h-5 ${isEnabled ? 'text-market-futures' : 'text-gray-500'}`} />
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-market-muted">{item.description}</div>
                      </div>
                      <div className={`
                        w-10 h-5 rounded-full transition-colors relative
                        ${isEnabled ? 'bg-market-futures' : 'bg-gray-700'}
                      `}>
                        <div className={`
                          absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                          ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}
                        `} />
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-market-border">
                <div className="text-xs text-market-muted text-center">
                  NIFTY Option Chain v1.0
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
