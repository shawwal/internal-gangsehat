export type Phase = 'parsing' | 'deduplicating' | 'checking' | 'importing'

export interface Progress {
  phase: Phase
  message: string
  total: number
  totalInFile: number
  processed: number
  imported: number
  skipped: number
  errors: number
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: number
  sheetUsed: string
}

export const PHASE_LABEL: Record<Phase, string> = {
  parsing:       'Membaca file...',
  deduplicating: 'Memproses data...',
  checking:      'Memeriksa duplikat...',
  importing:     'Mengimpor...',
}
