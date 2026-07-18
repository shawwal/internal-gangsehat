import { Users, CheckCircle2, AlertTriangle, MapPin } from 'lucide-react'
import type { EditableRow } from './types'

interface Props {
  sheetUsed: string
  totalRows: number
  skippedInvalid: number
  rows: EditableRow[]
}

export function PreviewSummary({ sheetUsed, totalRows, skippedInvalid, rows }: Props) {
  const included = rows.filter((r) => r.include).length
  const dbDuplicates = rows.filter((r) => r.duplicateInDb).length
  const needsLocationReview = rows.filter(
    (r) => !r.locationMatch.provinsi || !r.locationMatch.kabupatenKota || !r.locationMatch.kecamatan,
  ).length

  const stats = [
    { icon: Users, label: 'Ditemukan di file', value: rows.length, tone: 'text-foreground bg-muted' },
    { icon: CheckCircle2, label: 'Siap diimpor', value: included, tone: 'text-chart-4 bg-chart-4/10' },
    { icon: AlertTriangle, label: 'Sudah terdaftar', value: dbDuplicates, tone: 'text-secondary-foreground bg-secondary/20' },
    { icon: MapPin, label: 'Lokasi perlu ditinjau', value: needsLocationReview, tone: 'text-destructive bg-destructive/10' },
  ]

  return (
    <div className="glass-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Pratinjau — sheet &quot;{sheetUsed}&quot;
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totalRows} baris dibaca dari file, {skippedInvalid} dilewati (tanpa nama/no. HP).
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-2xl px-3 py-3 ${s.tone}`}>
            <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
              <s.icon size={13} />
              {s.label}
            </div>
            <p className="text-xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Provinsi/kab-kota/kecamatan dicocokkan otomatis ke daftar wilayah yang sama dengan halaman
        pendaftaran pasien. Baris yang ditandai kuning berarti tidak ditemukan kecocokan persis — silakan tinjau di tabel di bawah.
      </p>
    </div>
  )
}
