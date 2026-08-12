'use client'

import { useState } from 'react'
import { PackagePlus } from 'lucide-react'
import { BuyPackageDialog } from './BuyPackageDialog'

interface Props {
  branchId: string | null
  onSuccess: () => void
  compact?: boolean
}

export function BuyPackageButton({ branchId, onSuccess, compact }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Beli paket baru"
        className={
          compact
            ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-2xl border border-primary/30 text-primary text-[11px] font-semibold hover:bg-primary/10 transition-colors duration-150 cursor-pointer shrink-0'
            : 'flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-colors cursor-pointer'
        }
      >
        <PackagePlus size={compact ? 13 : 14} /> Beli Paket
      </button>

      {isOpen && (
        <BuyPackageDialog
          branchId={branchId}
          onClose={() => setIsOpen(false)}
          onSuccess={() => { setIsOpen(false); onSuccess() }}
        />
      )}
    </>
  )
}
