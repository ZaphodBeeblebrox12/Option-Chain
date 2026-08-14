import { useMarketStore } from '@/store/marketStore'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ConnectionStatus() {
  const status = useMarketStore((s) => s.connectionStatus)

  const config = {
    connected: { icon: Wifi, color: 'text-green-400', bg: 'bg-green-500/10', text: 'Connected' },
    connecting: { icon: Loader2, color: 'text-yellow-400', bg: 'bg-yellow-500/10', text: 'Connecting...' },
    disconnected: { icon: WifiOff, color: 'text-red-400', bg: 'bg-red-500/10', text: 'Disconnected' },
    error: { icon: WifiOff, color: 'text-red-500', bg: 'bg-red-500/10', text: 'Error' },
  }

  const { icon: Icon, color, bg, text } = config[status]

  return (
    <AnimatePresence>
      {status !== 'connected' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border border-white/10 ${bg} backdrop-blur-md`}
        >
          <Icon className={`w-5 h-5 ${color} ${status === 'connecting' ? 'animate-spin' : ''}`} />
          <span className={`text-sm font-medium ${color}`}>{text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
