'use client'

import { useState } from 'react'
import { PackagePlus } from 'lucide-react'
import { BuyPackageDialog } from './BuyPackageDialog'

interface Props {
  branchId: string | null
  onSuccess: () => void
}

export function BuyPackageButton({ branchId, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <PackagePlus size={14} /> Beli Paket
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
