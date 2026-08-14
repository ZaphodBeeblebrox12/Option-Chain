import { motion } from 'framer-motion'
import { useWebSocket } from '@/hooks/useWebSocket'
import MarketHeader from '@/components/MarketHeader'
import OptionChainTable from '@/components/OptionChainTable'
import Legend from '@/components/Legend'
import ConnectionStatus from '@/components/ConnectionStatus'
import SettingsPanel from '@/components/SettingsPanel'

function App() {
  const { isLive } = useWebSocket()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-[#0a0e1a] px-2 py-1"
    >
      {/* Demo mode banner */}
      {!isLive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-7xl mx-auto mb-1"
        >
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-[11px] font-medium">DEMO MODE</span>
              <span className="text-gray-500 text-[10px]">Market is closed. Showing simulated data for preview.</span>
            </div>
            <span className="text-gray-600 text-[10px] font-mono">Live data resumes at 09:15 IST</span>
          </div>
        </motion.div>
      )}

      <div className="max-w-7xl mx-auto space-y-1.5">
        <MarketHeader />
        <OptionChainTable />
        <Legend />
      </div>

      <ConnectionStatus />
      <SettingsPanel />
    </motion.div>
  )
}

export default App
