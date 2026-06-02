import { Users, Crown } from 'lucide-react'
import type { Tab } from './types'

interface Props {
  tab: Tab
  staffCount: number
  directorCount: number
  onChange: (tab: Tab) => void
}

export function UserTabs({ tab, staffCount, directorCount, onChange }: Props) {
  const items: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'staff',    label: 'Staff',    count: staffCount,    icon: <Users size={14} /> },
    { key: 'director', label: 'Direktur', count: directorCount, icon: <Crown size={14} /> },
  ]
  return (
    <div className="flex items-center gap-1 p-1 bg-muted/70 rounded-2xl w-fit border border-border">
      {items.map(({ key, label, count, icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            tab === key
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {icon}
          {label}
          <span className={`min-w-[20px] text-center text-xs px-1.5 py-0.5 rounded-full font-semibold transition-colors ${
            tab === key ? 'bg-primary text-primary-foreground' : 'bg-border text-muted-foreground'
          }`}>
            {count}
          </span>
        </button>
      ))}
    </div>
  )
}
