'use client'

import { useEffect, useState } from 'react'
import { useJadwalList } from '@/hooks/useJadwalList'
import { useToast } from '@/context/ToastContext'
import { PageHeader } from '@/components/jadwal/PageHeader'
import { DateNav } from '@/components/jadwal/DateNav'
import { JadwalListToolbar } from '@/components/jadwalList/JadwalListToolbar'
import { JadwalListTable } from '@/components/jadwalList/JadwalListTable'
import { Pagination } from '@/components/leave/Pagination'
import { DEFAULT_PAGE_SIZE, type JadwalListRow } from '@/components/jadwalList/types'
import { fetchReminderTemplate } from '@/app/actions/reminder-template'
import { fillTemplate, formatDate, formatWaNumber } from '@/lib/utils'

export default function JadwalHarianListPage() {
  const {
    today, selectedDate, setSelectedDate,
    rows, loading,
    branches, selectedBranchId, setSelectedBranchId,
    reload, handleCancel,
  } = useJadwalList()

  const { showToast } = useToast()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [reminderTemplate, setReminderTemplate] = useState<string | null>(null)

  useEffect(() => {
    fetchReminderTemplate().then(setReminderTemplate)
  }, [])

  useEffect(() => { setPage(1) }, [selectedDate, selectedBranchId, pageSize])

  const total = rows.length
  const from = (page - 1) * pageSize
  const pagedRows = rows.slice(from, from + pageSize)

  function handleRemind(row: JadwalListRow) {
    if (!row.patient_phone) return
    const branchName = branches.find((b) => b.id === row.branch_id)?.name ?? ''
    const msg = fillTemplate(reminderTemplate ?? '', {
      nama:      row.patient_name,
      tanggal:   formatDate(row.visit_date),
      jam:       row.visit_time ?? '',
      layanan:   row.service_type ?? '',
      cabang:    branchName,
      terapis:   row.attending_staff_name ?? '',
      order_id:  row.order_id ?? '',
    })
    const num = formatWaNumber(row.patient_phone)
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function handleCancelRow(row: JadwalListRow) {
    if (!row.patient_phone) return
    await handleCancel(row.id)
    showToast('Kunjungan dibatalkan', 'success')
    const msg = `Mohon maaf, jadwal terapi Anda pada ${formatDate(row.visit_date)}${row.visit_time ? ` pukul ${row.visit_time}` : ''} telah dibatalkan. Silakan hubungi klinik untuk penjadwalan ulang.`
    const num = formatWaNumber(row.patient_phone)
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader date={selectedDate} loading={loading} onRefresh={reload} />
        {branches.length > 0 && (
          <select
            value={selectedBranchId ?? ''}
            onChange={(e) => setSelectedBranchId(e.target.value || null)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
      </div>

      <DateNav selectedDate={selectedDate} today={today} onSelect={setSelectedDate} />

      <JadwalListToolbar pageSize={pageSize} onPageSizeChange={setPageSize} />

      <JadwalListTable
        rows={pagedRows}
        loading={loading}
        page={page}
        pageSize={pageSize}
        onRemind={handleRemind}
        onCancel={handleCancelRow}
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
    </div>
  )
}
