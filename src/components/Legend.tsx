import { Info } from 'lucide-react'

export default function Legend() {
  const items = [
    { label: '1st CE', class: 'bg-gradient-to-r from-red-700 to-red-600 text-white px-1.5 py-px rounded text-[9px] font-bold shadow-sm shadow-red-600/20' },
    { label: '2nd CE', class: 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-500/25 text-red-700 dark:text-red-300 px-1.5 py-px rounded text-[9px] font-semibold' },
    { label: '3rd CE', class: 'bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-500/15 text-red-600/80 dark:text-red-400/70 px-1.5 py-px rounded text-[9px]' },
    { label: '1st PE', class: 'bg-gradient-to-r from-green-700 to-green-600 text-white px-1.5 py-px rounded text-[9px] font-bold shadow-sm shadow-green-600/20' },
    { label: '2nd PE', class: 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-500/25 text-green-700 dark:text-green-300 px-1.5 py-px rounded text-[9px] font-semibold' },
    { label: '3rd PE', class: 'bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-500/15 text-green-600/80 dark:text-green-400/70 px-1.5 py-px rounded text-[9px]' },
    { label: 'ATM-Spot', class: 'bg-yellow-500 text-gray-900 px-1.5 py-px rounded text-[9px] font-bold' },
    { label: 'ATM-Fut', class: 'bg-cyan-500 text-gray-900 px-1.5 py-px rounded text-[9px] font-bold' },
    { label: 'ATM-Both', class: 'bg-purple-500 text-white px-1.5 py-px rounded text-[9px] font-bold' },
    { label: 'Max Pain', class: 'bg-orange-500 text-white px-1.5 py-px rounded text-[9px] font-bold' },
  ]

  return (
    <div className="glass-panel px-2 py-1.5 flex flex-wrap items-center gap-1.5 border border-gray-300 dark:border-gray-800/60">
      <Info className="w-3 h-3 text-gray-400" />
      {items.map((item) => (
        <span key={item.label} className={item.class}>{item.label}</span>
      ))}
      <span className="text-[9px] text-gray-500 ml-auto">OI Chg = change since last tick</span>
    </div>
  )
}
