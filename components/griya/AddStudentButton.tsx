'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { AddStudentDialog } from './AddStudentDialog'

interface Props {
  branchId: string | null
  canEdit: boolean
  onAdded: () => void
  variant?: 'primary' | 'outline'
}

export function AddStudentButton({ branchId, canEdit, onAdded, variant = 'primary' }: Props) {
  const [open, setOpen] = useState(false)
  if (!canEdit || !branchId) return null

  const cls = variant === 'primary'
    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
    : 'border border-border hover:bg-muted'

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer ${cls}`}>
        <UserPlus size={14} /> Tambah Siswa
      </button>
      {open && (
        <AddStudentDialog
          branchId={branchId}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); onAdded() }}
        />
      )}
    </>
  )
}
