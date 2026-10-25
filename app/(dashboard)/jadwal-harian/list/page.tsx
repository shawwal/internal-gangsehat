'use client'

import { useEffect, useState } from 'react'
import { useJadwalList } from '@/hooks/useJadwalList'
import { useToast } from '@/context/ToastContext'
import { PageHeader } from '@/components/jadwal/PageHeader'
import { DateNav } from '@/components/jadwal/DateNav'
import { JadwalListToolbar } from '@/components/jadwalList/JadwalListToolbar'
import type { EditField } from '@/components/jadwalList/JadwalListRow'
import { JadwalListTable } from '@/components/jadwalList/JadwalListTable'
import { JadwalListExportButton } from '@/components/jadwalList/JadwalListExportButton'
import { Pagination } from '@/components/leave/Pagination'
import {
  DEFAULT_PAGE_SIZE, MAX_RANGE_DAYS, NO_TARIF, PAGE_SIZE_OPTIONS, PAGE_SIZE_STORAGE_KEY,
  type JadwalListRow, type JadwalTarifOption,
} from '@/components/jadwalList/types'
import { fetchBranchStaff, type BranchStaffMember } from '@/app/actions/jadwal'
import { fetchJadwalTarifOptions } from '@/app/actions/jadwalList'
import { addDays, fmtHeaderDate, isSameDay, toIso } from '@/components/jadwal/utils'
import { fetchWaConfigAll, type WaConfigAll } from '@/app/actions/reminder-template'
import { resolveWaConfig } from '@/lib/waConfig'
import { fillTemplate, formatDate, formatHari, formatWaNumber } from '@/lib/utils'

export default function JadwalHarianListPage() {
  const {
    today, dateFrom, dateTo, setSelectedDate, setDateRange,
    rows, loading, error,
    branches, selectedBranchId, setSelectedBranchId,
    reload, handleCancel, handleEdit,
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
  const [tarifFilter, setTarifFilter]     = useState('')
  const [kehadiranFilter, setKehadiranFilter] = useState('')

  const [staff, setStaff] = useState<BranchStaffMember[]>([])
  useEffect(() => {
    if (!selectedBranchId) { setStaff([]); return }
    fetchBranchStaff(selectedBranchId).then(setStaff).catch(() => setStaff([]))
  }, [selectedBranchId])
  const staffOptions = staff.map((s) => ({ value: s.id, label: s.nickname || s.full_name }))

  // Layanan filter options come from the branch's Tarif Layanan price list.
  const [tarifList, setTarifList] = useState<JadwalTarifOption[]>([])
  useEffect(() => {
    if (!selectedBranchId) { setTarifList([]); return }
    fetchJadwalTarifOptions(selectedBranchId).then(setTarifList).catch(() => setTarifList([]))
  }, [selectedBranchId])

  // Keep the range within MAX_RANGE_DAYS by pulling the other end along.
  const fromDate = (iso: string) => new Date(iso + 'T00:00:00')
  function changeDateFrom(iso: string) {
    const from = fromDate(iso)
    const maxTo = addDays(from, MAX_RANGE_DAYS - 1)
    setDateRange(from, dateTo < from ? from : dateTo > maxTo ? maxTo : dateTo)
  }
  function changeDateTo(iso: string) {
    const to = fromDate(iso)
    const minFrom = addDays(to, -(MAX_RANGE_DAYS - 1))
    setDateRange(dateFrom > to ? to : dateFrom < minFrom ? minFrom : dateFrom, to)
  }

  async function handleEditRow(row: JadwalListRow, field: EditField, value: string) {
    const v = value === '' ? null : value
    const local: Partial<JadwalListRow> = {}
    if (field === 'attending_staff_id') {
      local.attending_staff_name = staffOptions.find((o) => o.value === v)?.label ?? null
    }
    // A date or time can't be blank — ignore an emptied value.
    if (field === 'visit_date' && !v) return
    const error = await handleEdit(row, { [field]: v }, local)
    showToast(error ?? 'Perubahan disimpan', error ? 'error' : 'success')
  }

  useEffect(() => {
    fetchWaConfigAll().then(setWaConfig)
  }, [])

  useEffect(() => { setPage(1) }, [dateFrom, dateTo, selectedBranchId, pageSize, fisioFilter, tarifFilter, kehadiranFilter])

  const uniqueSorted = (vals: (string | null)[]) =>
    [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'id'))
  const fisioOptions   = uniqueSorted(rows.map((r) => r.attending_staff_name))
  // Active tariffs, plus inactive ones that still appear in the loaded visits
  const usedTarif   = new Set(rows.map((r) => r.tarif_id))
  const tarifOptions = tarifList.filter((t) => t.is_active || usedTarif.has(t.id))

  const filteredRows = rows.filter((r) =>
    (!fisioFilter || r.attending_staff_name === fisioFilter) &&
    (!tarifFilter || (tarifFilter === NO_TARIF ? !r.tarif_id : r.tarif_id === tarifFilter)) &&
    (!kehadiranFilter || (kehadiranFilter === 'BELUM' ? !r.kehadiran : r.kehadiran === kehadiranFilter)))
  const total = filteredRows.length
  const from = (page - 1) * pageSize
  const pagedRows = filteredRows.slice(from, from + pageSize)

  const isRange = !isSameDay(dateFrom, dateTo)
  const rangeLabel = isRange ? `${fmtHeaderDate(dateFrom)} – ${fmtHeaderDate(dateTo)}` : fmtHeaderDate(dateFrom)
  const branchName = branches.find((b) => b.id === selectedBranchId)?.name ?? ''
  const activeFilters = [
    fisioFilter && `Fisio: ${fisioFilter}`,
    tarifFilter && `Layanan: ${tarifFilter === NO_TARIF ? 'Tanpa tarif layanan' : tarifList.find((t) => t.id === tarifFilter)?.nama ?? '—'}`,
    kehadiranFilter && `Kehadiran: ${kehadiranFilter === 'BELUM' ? 'Belum Diisi' : kehadiranFilter}`,
  ].filter((f): f is string => !!f)

  function handleRemind(row: JadwalListRow) {
    if (!row.patient_phone) return
    const branchName = branches.find((b) => b.id === row.branch_id)?.name ?? ''
    const msg = fillTemplate(resolveWaConfig(waConfig, row.branch_id).reminder, {
      nama:        row.patient_name,
      hari:        formatHari(row.visit_date),
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
    await handleCancel(row)
    showToast('Kunjungan dibatalkan', 'success')
    const msg = `Mohon maaf, jadwal terapi Anda pada ${formatDate(row.visit_date)}${row.visit_time ? ` pukul ${row.visit_time}` : ''} telah dibatalkan. Silakan hubungi klinik untuk penjadwalan ulang.`
    const num = formatWaNumber(row.patient_phone)
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PageHeader date={dateFrom} loading={loading} onRefresh={reload} subtitle={rangeLabel} />
        <div className="flex items-center gap-2 flex-wrap">
          <JadwalListExportButton
            rows={filteredRows}
            branchName={branchName}
            dateFrom={toIso(dateFrom)}
            dateTo={toIso(dateTo)}
            filters={activeFilters}
          />
          {branches.length > 0 && (
            <select
              value={selectedBranchId ?? ''}
              onChange={(e) => { setTarifFilter(''); setSelectedBranchId(e.target.value || null) }}
              className="px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <DateNav selectedDate={dateFrom} today={today} onSelect={setSelectedDate} />

      <JadwalListToolbar
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        dateFrom={toIso(dateFrom)}
        dateTo={toIso(dateTo)}
        onDateFromChange={changeDateFrom}
        onDateToChange={changeDateTo}
        fisioOptions={fisioOptions}
        fisio={fisioFilter}
        onFisioChange={setFisioFilter}
        tarifOptions={tarifOptions}
        tarif={tarifFilter}
        onTarifChange={setTarifFilter}
        kehadiran={kehadiranFilter}
        onKehadiranChange={setKehadiranFilter}
      />

      {error && !loading && (
        <div className="glass-card px-4 py-3 text-sm text-destructive flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={reload} className="font-medium underline cursor-pointer">Coba lagi</button>
        </div>
      )}

      <JadwalListTable
        rows={pagedRows}
        loading={loading}
        page={page}
        pageSize={pageSize}
        onRemind={handleRemind}
        onConfirm={handleConfirm}
        onCancel={handleCancelRow}
        fisioOptions={staffOptions}
        onEdit={handleEditRow}
      />

      <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} />
    </div>
  )
}
