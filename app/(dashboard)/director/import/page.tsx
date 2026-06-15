'use client'

import Link from 'next/link'
import { ChevronLeft, Package } from 'lucide-react'
import { BackfillCard } from '@/components/import/BackfillCard'
import { UploadCard } from '@/components/import/UploadCard'

export default function ImportPasienPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/patients" className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors text-muted-foreground">
          <ChevronLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import Data Pasien</h1>
          <p className="text-sm text-muted-foreground">Upload file Excel untuk menambah data pasien secara massal</p>
        </div>
      </div>

      {/* Quick link to package import */}
      <Link
        href="/director/import-packages"
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors group"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Package size={17} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Import Paket Terapi</p>
          <p className="text-xs text-muted-foreground">Dari sheet PEMASUKAN (Catatan Keuangan) →</p>
        </div>
      </Link>

      <BackfillCard />
      <UploadCard />
    </div>
  )
}
