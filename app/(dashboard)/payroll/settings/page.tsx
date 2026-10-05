'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Settings2 } from 'lucide-react'
import { useToast } from '@/context/ToastContext'
import { getPayrollSettingsData, type PayrollSettingsData } from '@/app/actions/payrollSettings'
import { EmployeesTab } from '@/components/payroll/settings/EmployeesTab'
import { ActivityTypesTab, HolidaysTab, PeriodSettingsTab, RulesTab } from '@/components/payroll/settings/ConfigTabs'
import { TableSkeleton } from '@/components/ui/Skeleton'

type Tab = 'employees' | 'rules' | 'holidays' | 'activities' | 'period'

const TABS: { key: Tab; label: string }[] = [
  { key: 'employees', label: 'Karyawan & Kompensasi' },
  { key: 'rules', label: 'Aturan Potongan' },
  { key: 'holidays', label: 'Hari Libur' },
  { key: 'activities', label: 'Katalog Aktivitas' },
  { key: 'period', label: 'Periode & Slip' },
]

export default function PayrollSettingsPage() {
  const { showToast } = useToast()
  const [data, setData] = useState<PayrollSettingsData | null>(null)
  const [branchId, setBranchId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('employees')

  const load = useCallback(async () => {
    const res = await getPayrollSettingsData(branchId)
    if (!res.ok) { showToast(res.error, 'error'); return }
    setData(res.data)
  }, [branchId, showToast])

  useEffect(() => {
    let cancelled = false
    getPayrollSettingsData(branchId).then((res) => {
      if (cancelled) return
      if (!res.ok) showToast(res.error, 'error')
      else setData(res.data)
    })
    return () => { cancelled = true }
  }, [branchId, showToast])

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/payroll" className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center shrink-0 hover:bg-muted/70" aria-label="Kembali">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2"><Settings2 size={17} className="text-primary" /> Pengaturan Penggajian</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Data karyawan, kompensasi, tarif dan aturan — semua angka gaji diatur di sini, bukan di kode.</p>
          </div>
        </div>
        {data && data.branches.length > 1 && (
          <select className="px-3 py-2 rounded-xl border border-border bg-background text-sm" value={data.branchId}
            onChange={(e) => setBranchId(e.target.value)} aria-label="Cabang">
            {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-muted/40 rounded-2xl overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground/60 hover:text-foreground hover:bg-muted'
            }`}>{t.label}</button>
        ))}
      </div>

      {!data ? <TableSkeleton rows={8} cols={6} /> : (
        <>
          {tab === 'employees' && <EmployeesTab data={data} onChanged={load} />}
          {tab === 'rules' && <RulesTab data={data} onChanged={load} />}
          {tab === 'holidays' && <HolidaysTab data={data} onChanged={load} />}
          {tab === 'activities' && <ActivityTypesTab data={data} onChanged={load} />}
          {tab === 'period' && <PeriodSettingsTab key={data.branchId} data={data} onChanged={load} />}
        </>
      )}
    </div>
  )
}
