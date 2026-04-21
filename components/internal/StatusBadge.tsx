'use client'

import { useTranslation } from '@/hooks/useTranslation'

const colorMap: Record<string, string> = {
  waiting_confirmation: 'bg-blue-100 text-blue-700',
  confirmed:            'bg-yellow-100 text-yellow-700',
  in_progress:          'bg-yellow-100 text-yellow-700',
  completed:            'bg-green-100 text-green-700',
  cancelled:            'bg-red-100 text-red-700',
  Lunas:                'bg-green-100 text-green-700',
  'Belum Lunas':        'bg-orange-100 text-orange-700',
  TERSEDIA:             'bg-green-100 text-green-700',
  OFF:                  'bg-gray-100 text-gray-600',
  CUTI:                 'bg-purple-100 text-purple-700',
  MASUK:                'bg-teal-100 text-teal-700',
  MENUNGGU:             'bg-yellow-100 text-yellow-700',
  DISETUJUI:            'bg-green-100 text-green-700',
  DITOLAK:              'bg-red-100 text-red-700',
  PAGI:                 'bg-sky-100 text-sky-700',
  SORE:                 'bg-orange-100 text-orange-700',
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
  const color = colorMap[value] ?? 'bg-gray-100 text-gray-600'
  const label = labelKeyMap[value] ? t(labelKeyMap[value]) : value

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}
