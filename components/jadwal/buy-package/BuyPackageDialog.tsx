'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Package, X } from 'lucide-react'
import type { PatientPlain } from '@/app/actions/patients'
import { PatientPickerStep } from './PatientPickerStep'
import { PackageForm } from './PackageForm'
import type { BuyPackageDialogProps, PackageCategory } from './types'

interface Props extends BuyPackageDialogProps {
  lockedCategory?: PackageCategory
  title?: string
  subtitle?: string
  initialPatient?: PatientPlain | null
}

export function BuyPackageDialog({
  branchId, onClose, onSuccess, lockedCategory, title, subtitle, initialPatient,
}: Props) {
  const [patient, setPatient] = useState<PatientPlain | null>(initialPatient ?? null)

  // Portalled to document.body so this isn't trapped behind ancestors that
  // establish their own stacking context (e.g. the focus-mode bar's
  // backdrop-blur), which otherwise renders the dialog behind the page.
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package size={15} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{title ?? 'Beli Paket Baru'}</p>
              <p className="text-xs text-muted-foreground">{subtitle ?? 'Tanpa perlu jadwal kunjungan'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <PatientPickerStep patient={patient} onSelect={setPatient} />

          {patient && (
            <PackageForm
              patientId={patient.id}
              patientName={patient.name}
              branchId={branchId}
              lockedCategory={lockedCategory}
              onCancel={onClose}
              onSuccess={onSuccess}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
