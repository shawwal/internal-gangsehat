export interface PreviewRow {
  tempId: string
  no_rm: string | null
  no_rm_cleared: boolean
  name: string
  phone: string
  gender: 'male' | 'female' | 'other'
  birthDate: string
  address: string
  provinsi: string
  kabupatenKota: string
  kecamatan: string
  kelurahan: string
  agama: string
  pekerjaan: string
  hobi: string
  keluhan: string
  duplicateInDb: boolean
  locationMatch: { provinsi: boolean; kabupatenKota: boolean; kecamatan: boolean }
  sourceRow: number
}

export interface EditableRow extends PreviewRow {
  include: boolean
}

export interface PreviewResponse {
  sheetUsed: string
  totalRows: number
  skippedInvalid: number
  rows: PreviewRow[]
}

export type CommitPhase = 'checking' | 'importing'

export interface CommitProgress {
  phase: CommitPhase
  imported: number
  skipped: number
  errors: number
  total: number
  processed: number
}

export interface CommitResult {
  imported: number
  skipped: number
  errors: number
}
