'use client'

import { fetchPatientsForExport, type PatientPlain } from '@/app/actions/patients'
import { exportToExcel, type ExportColumn } from '@/lib/excel-export'
import { ExportButton } from '@/components/ui/ExportButton'
import type { PatientFiltersState } from './types'
import { GENDER_LABEL } from './types'

const COLUMNS: ExportColumn<PatientPlain>[] = [
  { header: 'No. RM',         value: (r) => r.no_rm ?? '' },
  { header: 'Nama',           value: (r) => r.name },
  { header: 'Jenis Kelamin',  value: (r) => (r.gender ? GENDER_LABEL[r.gender] : '') ?? '' },
  { header: 'Telepon',        value: (r) => r.phone },
  { header: 'Tgl. Lahir',     value: (r) => r.birthDate ?? '' },
  { header: 'Alamat',         value: (r) => r.address ?? '' },
  { header: 'Kelurahan',      value: (r) => r.kelurahan ?? '' },
  { header: 'Kecamatan',      value: (r) => r.kecamatan ?? '' },
  { header: 'Kota/Kab',       value: (r) => r.kabupaten_kota ?? '' },
  { header: 'Provinsi',       value: (r) => r.provinsi ?? '' },
  { header: 'Pekerjaan',      value: (r) => r.pekerjaan ?? '' },
  { header: 'Agama',          value: (r) => r.agama ?? '' },
  { header: 'Hobi',           value: (r) => r.hobi ?? '' },
  { header: 'Gol. Darah',     value: (r) => r.blood_type ?? '' },
  { header: 'Alergi',         value: (r) => r.allergies ?? '' },
  { header: 'Catatan Medis',  value: (r) => r.medical_notes ?? '' },
  { header: 'Keluhan',        value: (r) => r.keluhan ?? '' },
  { header: 'Tgl. Daftar',    value: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID') : '' },
]

interface Props {
  filters: PatientFiltersState
}

export function PatientExportButton({ filters }: Props) {
  async function handleExport() {
    const data = await fetchPatientsForExport({
      gender:         filters.gender,
      search:         filters.search,
      sortField:      filters.sortField,
      sortOrder:      filters.sortOrder,
      myPatientsOnly: filters.myPatientsOnly,
    })
    const today = new Date().toISOString().slice(0, 10)
    exportToExcel(data, COLUMNS, `pasien_${today}`)
  }

  return <ExportButton onExport={handleExport} label="Export Excel" />
}
