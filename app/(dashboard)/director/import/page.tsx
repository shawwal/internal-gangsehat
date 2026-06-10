'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
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

      <BackfillCard />
      <UploadCard />
    </div>
  )
}
