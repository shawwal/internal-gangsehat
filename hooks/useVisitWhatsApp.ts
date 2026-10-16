'use client'

import { useEffect, useState } from 'react'
import { fetchWaConfigAll, type WaConfigAll } from '@/app/actions/reminder-template'
import { resolveWaConfig } from '@/lib/waConfig'
import { fillTemplate, formatDate, formatHari, formatWaNumber } from '@/lib/utils'
import type { DailyVisit } from '@/app/actions/jadwal'

interface StaffLite { staff_id: string; full_name: string; nickname?: string | null }

/** WhatsApp reminder / confirmation for a jadwal grid visit — shared by the
 *  fisio (jadwal-harian) and Sport Massage schedules so both send the same
 *  branch template with the same order ID. */
export function useVisitWhatsApp(
  visits: DailyVisit[],
  staff: StaffLite[],
  branches: { id: string; name: string }[],
) {
  const [waConfig, setWaConfig] = useState<WaConfigAll | null>(null)
  useEffect(() => {
    fetchWaConfigAll().then(setWaConfig)
  }, [])

  function send(kind: 'reminder' | 'confirmation', visitId: string) {
    const visit = visits.find((v) => v.id === visitId)
    if (!visit || !visit.patient_phone) return

    const cfg = resolveWaConfig(waConfig, visit.branch_id)
    const attending = staff.find((s) => s.staff_id === visit.attending_staff_id)
    const msg = fillTemplate(kind === 'reminder' ? cfg.reminder : cfg.confirmation, {
      nama:        visit.patient_name,
      hari:        formatHari(visit.visit_date),
      tanggal:     formatDate(visit.visit_date),
      jam:         visit.visit_time ?? '',
      layanan:     visit.service_type ?? '',
      cabang:      branches.find((b) => b.id === visit.branch_id)?.name ?? '',
      ...(kind === 'reminder' ? { terapis: attending?.nickname || attending?.full_name || '' } : {}),
      order_id:    visit.order_id ?? '',
      nomor_admin: cfg.phone,
    })

    const num = formatWaNumber(visit.patient_phone)
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return {
    handleWhatsAppReminder:     (visitId: string) => send('reminder', visitId),
    handleWhatsAppConfirmation: (visitId: string) => send('confirmation', visitId),
  }
}
