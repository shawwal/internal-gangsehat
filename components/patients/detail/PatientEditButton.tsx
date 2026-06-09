'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'

interface Props {
  patientId: string
}

export function PatientEditButton({ patientId }: Props) {
  return (
    <Link
      href={`/patients/${patientId}/edit`}
      aria-label="Edit data pasien"
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted hover:border-primary/40 transition-colors duration-150 cursor-pointer min-w-[44px] min-h-[44px] justify-center"
    >
      <Pencil size={13} />
      <span className="hidden sm:inline">Edit</span>
    </Link>
  )
}
