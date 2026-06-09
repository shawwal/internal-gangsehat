// Shared constants and pure helpers for the patient detail page.
// No React imports — safe to import in both server and client components.

export const GENDER_LABEL: Record<string, string> = {
  male: 'Laki-laki', female: 'Perempuan', other: 'Lainnya',
}

export const GENDER_OPTIONS: { value: 'male' | 'female' | 'other'; label: string }[] = [
  { value: 'male',   label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
  { value: 'other',  label: 'Lainnya' },
]

export const AGAMA_OPTIONS = [
  'ISLAM', 'KRISTEN PROTESTAN', 'KRISTEN KATOLIK',
  'HINDU', 'BUDHA', 'KONGHUCU', 'LAINNYA',
]

// Must match DB CHECK constraint: blood_type = ANY('A','B','AB','O','unknown')
export const BLOOD_TYPE_OPTIONS = ['A', 'B', 'AB', 'O', 'unknown']

export const STATUS_BADGE: Record<string, string> = {
  scheduled: 'bg-secondary/20 text-secondary-foreground',
  completed:  'bg-chart-4/15 text-chart-4',
  cancelled:  'bg-destructive/10 text-destructive',
  no_show:    'bg-muted text-muted-foreground',
}

export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Terjadwal',
  completed:  'Selesai',
  cancelled:  'Dibatalkan',
  no_show:    'Tidak Hadir',
}

export const AVATAR_BG: Record<string, string> = {
  male:   'bg-blue-500/20 text-blue-600',
  female: 'bg-primary/20 text-primary',
  other:  'bg-secondary/20 text-secondary-foreground',
}

export function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function formatDateTime(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function calcAge(birthDate: string | null): string {
  if (!birthDate) return '—'
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return `${age} tahun`
}

export function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
