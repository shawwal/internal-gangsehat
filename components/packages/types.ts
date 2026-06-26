import type {
  PatientPackage, PackageSession, JenisPaket, PackageOperationalStatus,
  PackageCompletionStatus, PackageStatus,
} from '@/types'

export type { PatientPackage, PackageSession, JenisPaket, PackageOperationalStatus, PackageCompletionStatus, PackageStatus }

// ── Form ──────────────────────────────────────────────────────────────────────
export const DEFAULT_FORM = {
  package_name:       '',
  jenis_paket:        'P1' as JenisPaket,
  mulai_paket:        'NEW' as 'NEW' | 'EXT.',
  operational_status: 'ON' as PackageOperationalStatus,
  completion_status:  '' as PackageCompletionStatus | '',
  status:             'active' as PackageStatus,
  notes:              '',
}

export type FormState = typeof DEFAULT_FORM

// ── Badge maps ────────────────────────────────────────────────────────────────
export const OP_STATUS_BADGE: Record<PackageOperationalStatus, string> = {
  ON:      'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20',
  OFF:     'bg-muted/40 text-muted-foreground border-border',
  PENDING: 'bg-secondary/20 text-secondary-foreground border-secondary/20',
}

export const STATUS_BADGE: Record<PackageStatus, string> = {
  active:    'bg-primary/15 text-primary border-primary/20',
  completed: 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/20',
}

export const STATUS_LABEL: Record<PackageStatus, string> = {
  active:    'Aktif',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

export const COMPLETION_LABEL: Record<PackageCompletionStatus, string> = {
  LANJUT:         'Lanjut',
  SEMBUH:         'Sembuh',
  'TIDAK LANJUT': 'Tidak Lanjut',
  STOP:           'Stop',
}

export const COMPLETION_BADGE: Record<PackageCompletionStatus, string> = {
  LANJUT:         'bg-blue-500/15 text-blue-400 border-blue-500/20',
  SEMBUH:         'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20',
  'TIDAK LANJUT': 'bg-muted/40 text-muted-foreground border-border',
  STOP:           'bg-destructive/15 text-destructive border-destructive/20',
}

// ── Shared style strings ──────────────────────────────────────────────────────
export const INPUT_CLS = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
export const LABEL_CLS = 'block text-xs font-medium text-foreground mb-1.5'
