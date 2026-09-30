'use client'

import { useEffect, useState } from 'react'
import { useJadwalList } from '@/hooks/useJadwalList'
import { useToast } from '@/context/ToastContext'
import { PageHeader } from '@/components/jadwal/PageHeader'
import { DateNav } from '@/components/jadwal/DateNav'
import { JadwalListToolbar } from '@/components/jadwalList/JadwalListToolbar'
import { JadwalListTable } from '@/components/jadwalList/JadwalListTable'
import { Pagination } from '@/components/leave/Pagination'
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PAGE_SIZE_STORAGE_KEY, type JadwalListRow } from '@/components/jadwalList/types'
import { fetchWaConfigAll, type WaConfigAll } from '@/app/actions/reminder-template'
import { resolveWaConfig } from '@/lib/waConfig'
import { fillTemplate, formatDate, formatHari, formatWaNumber } from '@/lib/utils'

export default function JadwalHarianListPage() {
  const {
    today, selectedDate, setSelectedDate,
    rows, loading,
    branches, selectedBranchId, setSelectedBranchId,
    reload, handleCancel,
  } = useJadwalList()

  const { showToast } = useToast()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState<number>(DEFAULT_PAGE_SIZE)

  // Remember the user's chosen page size across visits.
  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY))
      if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(saved)) setPageSizeState(saved)
    } catch {}
  }, [])

  function setPageSize(size: number) {
    setPageSizeState(size)
    try { window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size)) } catch {}
  }
  const [waConfig, setWaConfig] = useState<WaConfigAll | null>(null)
  const [fisioFilter, setFisioFilter]     = useState('')
  const [layananFilter, setLayananFilter] = useState('')

  useEffect(() => {
    fetchWaConfigAll().then(setWaConfig)
  }, [])

  useEffect(() => { setPage(1) }, [selectedDate, selectedBranchId, pageSize, fisioFilter, layananFilter])

  const uniqueSorted = (vals: (string | null)[]) =>
    [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'id'))
  const fisioOptions   = uniqueSorted(rows.map((r) => r.attending_staff_name))
  const layananOptions = uniqueSorted(rows.map((r) => r.layanan_label))

  const filteredRows = rows.filter((r) =>
    (!fisioFilter || r.attending_staff_name === fisioFilter) &&
    (!layananFilter || r.layanan_label === layananFilter))
  const total = filteredRows.length
  const from = (page - 1) * pageSize
  const pagedRows = filteredRows.slice(from, from + pageSize)

  function handleRemind(row: JadwalListRow) {
    if (!row.patient_phone) return
    const branchName = branches.find((b) => b.id === row.branch_id)?.name ?? ''
    const msg = fillTemplate(resolveWaConfig(waConfig, row.branch_id).reminder, {
      nama:        row.patient_name,
      tanggal:     formatDate(row.visit_date),
      jam:         row.visit_time ?? '',
      layanan:     row.layanan_label ?? '',
      cabang:      branchName,
      terapis:     row.attending_staff_name ?? '',
      order_id:    row.order_id ?? '',
      nomor_admin: resolveWaConfig(waConfig, row.branch_id).phone,
    })
    const num = formatWaNumber(row.patient_phone)
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function handleConfirm(row: JadwalListRow) {
    if (!row.patient_phone) return
    const branchName = branches.find((b) => b.id === row.branch_id)?.name ?? ''
    const msg = fillTemplate(resolveWaConfig(waConfig, row.branch_id).confirmation, {
      nama:        row.patient_name,
      hari:        formatHari(row.visit_date),
      tanggal:     formatDate(row.visit_date),
      jam:         row.visit_time ?? '',
      layanan:     row.layanan_label ?? '',
      cabang:      branchName,
      order_id:    row.order_id ?? '',
      nomor_admin: resolveWaConfig(waConfig, row.branch_id).phone,
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

      <JadwalListToolbar
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        fisioOptions={fisioOptions}
        fisio={fisioFilter}
        onFisioChange={setFisioFilter}
        layananOptions={layananOptions}
        layanan={layananFilter}
        onLayananChange={setLayananFilter}
      />

      <JadwalListTable
        rows={pagedRows}
        loading={loading}
        page={page}
        pageSize={pageSize}
        onRemind={handleRemind}
        onConfirm={handleConfirm}
        onCancel={handleCancelRow}
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
    </div>
  )
}
