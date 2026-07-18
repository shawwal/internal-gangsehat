import { PatientEditTableRow } from './PatientEditTableRow'
import type { EditableRow } from './types'

const th = 'px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap'

interface Props {
  rows: EditableRow[]
  onChange: (tempId: string, patch: Partial<EditableRow>) => void
  onRemove: (tempId: string) => void
}

export function PatientEditTable({ rows, onChange, onRemove }: Props) {
  if (rows.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-sm text-muted-foreground">
        Tidak ada baris pasien yang valid untuk ditampilkan.
      </div>
    )
  }

  return (
    <div className="glass-card p-0 overflow-hidden">
      <div className="overflow-x-auto max-h-[32rem]">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-card z-10 border-b border-border">
            <tr>
              <th className={th}>Import</th>
              <th className={th}>Baris</th>
              <th className={th}>No. RM</th>
              <th className={th}>Nama</th>
              <th className={th}>No. HP</th>
              <th className={th}>Gender</th>
              <th className={th}>Tgl Lahir</th>
              <th className={th}>Alamat</th>
              <th className={th}>Provinsi</th>
              <th className={th}>Kab/Kota</th>
              <th className={th}>Kecamatan</th>
              <th className={th}>Kelurahan</th>
              <th className={th}>Agama</th>
              <th className={th}>Pekerjaan</th>
              <th className={th}>Hobi</th>
              <th className={th}>Keluhan</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PatientEditTableRow key={row.tempId} row={row} onChange={onChange} onRemove={onRemove} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
