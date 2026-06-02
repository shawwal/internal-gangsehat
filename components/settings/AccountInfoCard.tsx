import { Mail, ShieldCheck, Building2 } from 'lucide-react'
import { ROLE_LABELS } from './types'
import type { SettingsProfile } from './types'

interface Props {
  initialData: Pick<SettingsProfile, 'email' | 'role' | 'branch_name'>
}

const fields = [
  {
    key: 'email' as const,
    label: 'Email',
    Icon: Mail,
    getValue: (d: Props['initialData']) => d.email,
  },
  {
    key: 'role' as const,
    label: 'Peran',
    Icon: ShieldCheck,
    getValue: (d: Props['initialData']) => ROLE_LABELS[d.role] ?? d.role,
  },
  {
    key: 'branch' as const,
    label: 'Cabang',
    Icon: Building2,
    getValue: (d: Props['initialData']) => d.branch_name ?? 'Semua Cabang',
  },
]

export function AccountInfoCard({ initialData }: Props) {
  return (
    <div className="space-y-3">
      {fields.map(({ key, label, Icon, getValue }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-foreground mb-1">
            {label}
          </label>
          <div className="w-full flex items-center gap-2 px-3 py-2 border border-border rounded-xl text-sm bg-muted text-muted-foreground cursor-not-allowed select-none">
            <Icon size={14} className="shrink-0" />
            <span className="truncate">{getValue(initialData)}</span>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Hubungi direktur untuk mengubah data akun.
      </p>
    </div>
  )
}
