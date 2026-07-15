'use client'

import { Building2 } from 'lucide-react'
import { inputCls, labelCls } from './constants'

interface Branch {
  id: string
  name: string
}

interface Props {
  branches: Branch[]
  branchId: string | null
  onChange: (branchId: string) => void
}

export function OrderBranchSelect({ branches, branchId, onChange }: Props) {
  return (
    <div className="glass-card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Building2 size={14} className="text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Cabang</h2>
        <span className="text-destructive text-sm">*</span>
      </div>
      <div>
        <label className={labelCls}>Pilih Cabang</label>
        <select
          value={branchId ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} cursor-pointer`}
        >
          <option value="" disabled>— Pilih cabang —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1.5">
          Menentukan daftar layanan yang tersedia untuk order ini.
        </p>
      </div>
    </div>
  )
}
