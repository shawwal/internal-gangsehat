'use client'

import { Building2 } from 'lucide-react'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { CATEGORY_DEFS } from '@/components/targetProgress/types'
import type { CategoryKey } from '@/components/targetProgress/types'
import type { BranchOption } from './types'
import type { DisabledCategoryMap } from './useBranchCategorySettings'

interface Props {
  branches: BranchOption[]
  disabled: DisabledCategoryMap
  loading: boolean
  onToggle: (branchId: string, category: CategoryKey, enable: boolean) => void
}

export function CategorySettingsPanel({ branches, disabled, loading, onToggle }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-muted rounded-3xl h-24" />
        ))}
      </div>
    )
  }

  if (branches.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Building2 size={22} className="text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground">Tidak ada cabang</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Nonaktifkan kategori yang tidak dipakai cabang tertentu — kategori yang dinonaktifkan akan
        disembunyikan dari form target cabang dan halaman Progress Target.
      </p>
      {branches.map(branch => {
        const branchDisabled = disabled[branch.id] ?? new Set<CategoryKey>()
        return (
          <div key={branch.id} className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-primary shrink-0" />
              <h3 className="text-sm font-semibold text-foreground">{branch.name}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {CATEGORY_DEFS.map(def => {
                const enabled = !branchDisabled.has(def.key)
                return (
                  <div
                    key={def.key}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/40"
                  >
                    <span className="text-xs font-medium text-foreground">{def.label}</span>
                    <ToggleSwitch
                      checked={enabled}
                      onClick={() => onToggle(branch.id, def.key, !enabled)}
                      label={`${enabled ? 'Nonaktifkan' : 'Aktifkan'} ${def.label} untuk ${branch.name}`}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
