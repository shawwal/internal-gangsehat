'use client'

import { Package } from 'lucide-react'
import type { LayananRow } from '@/app/actions/layanan'
import { LayananPicker } from './LayananPicker'

interface Props {
  branchId: string | null
  selectedLayanan: LayananRow | null
  onSelectLayanan: (layanan: LayananRow) => void
}

export function PaketTab({ branchId, selectedLayanan, onSelectLayanan }: Props) {
  return (
    <div className="space-y-3">
      <LayananPicker branchId={branchId} selected={selectedLayanan} onSelect={onSelectLayanan} />

      {selectedLayanan && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <Package size={12} className="text-primary shrink-0" />
          <span className="text-xs font-semibold text-primary">Dipilih: {selectedLayanan.nama}</span>
        </div>
      )}
    </div>
  )
}
