'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PatientImportClient } from '@/components/import-v2/PatientImportClient'

export default function ImportPatientsV2Page() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/director/import" className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
          <ChevronLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Pasien — Template Baru</h1>
          <p className="text-sm text-muted-foreground">
            Untuk file Excel dengan format template pasien (Tanggal, No. RM, Usia, Kategori Usia, dll). Tinjau dan
            edit data sebelum disimpan ke database.
          </p>
        </div>
      </div>

      <PatientImportClient />
    </div>
  )
}
