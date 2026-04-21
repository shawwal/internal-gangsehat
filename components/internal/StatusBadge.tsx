'use client'

import { useTranslation } from '@/hooks/useTranslation'

const colorMap: Record<string, string> = {
  waiting_confirmation: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  confirmed:            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  in_progress:          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  completed:            'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:            'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Lunas:                'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Belum Lunas':        'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  TERSEDIA:             'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  OFF:                  'bg-muted text-muted-foreground',
  CUTI:                 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  MASUK:                'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  MENUNGGU:             'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  DISETUJUI:            'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  DITOLAK:              'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  PAGI:                 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  SORE:                 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
}

const labelKeyMap: Record<string, string> = {
  waiting_confirmation: 'status.waiting_confirmation',
  confirmed:            'status.confirmed',
  in_progress:          'status.in_progress',
  completed:            'status.completed',
  cancelled:            'status.cancelled',
  Lunas:                'status.paid',
  'Belum Lunas':        'status.unpaid',
  TERSEDIA:             'status.available',
  OFF:                  'status.off',
  CUTI:                 'status.on_leave',
  MASUK:                'status.present',
  MENUNGGU:             'status.pending',
  DISETUJUI:            'status.approved',
  DITOLAK:              'status.rejected',
  PAGI:                 'nav.shift_hours',
  SORE:                 'nav.shift_hours',
}

interface Props {
  value: string
}

export function StatusBadge({ value }: Props) {
  const { t } = useTranslation()
  const color = colorMap[value] ?? 'bg-muted text-muted-foreground'
  const label = labelKeyMap[value] ? t(labelKeyMap[value]) : value

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}
