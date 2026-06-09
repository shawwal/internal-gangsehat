'use client'

import { HeartPulse, PlusCircle } from 'lucide-react'

interface Props {
  totalPatients: number
  onAdd:         () => void
}

export function PatientEmpty({ totalPatients, onAdd }: Props) {
  const noData    = totalPatients === 0
  const headline  = noData ? 'Belum ada data pasien' : 'Tidak ada pasien ditemukan'
  const subtext   = noData
    ? 'Tambahkan pasien baru untuk memulai pencatatan kunjungan.'
    : 'Coba ubah kata kunci pencarian atau pilih filter yang lain.'

  return (
    <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
        <HeartPulse size={22} className="text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground">{headline}</p>
      <p className="text-xs text-muted-foreground text-center max-w-xs">{subtext}</p>
      {noData && (
        <button
          onClick={onAdd}
          className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <PlusCircle size={14} />
          Tambah Pasien Pertama
        </button>
      )}
    </div>
  )
}
