import { PlusCircle, Target } from 'lucide-react'
import { MONTHS } from './types'

interface Props {
  month: number   // 0-indexed (Date.getMonth())
  year: number
  onClick: () => void
}

export function CurrentMonthPrompt({ month, year, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-3xl cursor-pointer hover:bg-primary/10 transition-colors group"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        <Target size={18} className="text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">
          Belum ada target untuk {MONTHS[month]} {year}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Klik untuk mengajukan target bulan ini</p>
      </div>
      <PlusCircle size={16} className="text-primary shrink-0" />
    </div>
  )
}
