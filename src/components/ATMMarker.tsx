import { motion } from 'framer-motion'

interface ATMMarkerProps {
  markers: string[]
}

export default function ATMMarker({ markers }: ATMMarkerProps) {
  if (markers.length === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-0.5"
    >
      {markers.map((marker) => (
        <span
          key={marker}
          className={`text-[8px] font-bold px-1 py-px rounded whitespace-nowrap ${
            marker.includes('MAX PAIN') ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30' :
            marker.includes('ATM-BOTH') ? 'bg-purple-500 text-white shadow-sm shadow-purple-500/30' :
            marker.includes('ATM-SPOT') ? 'bg-yellow-500 text-gray-900' :
            marker.includes('ATM-FUT') ? 'bg-cyan-500 text-gray-900' :
            marker.includes('MAX CE') ? 'bg-red-600 text-white' :
            marker.includes('MAX PE') ? 'bg-green-600 text-white' : ''
          }`}
        >
          {marker}
        </span>
      ))}
    </motion.div>
  )
}
