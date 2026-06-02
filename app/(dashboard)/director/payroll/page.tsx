'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

import { usePayrollIdentity }  from './_hooks/usePayrollIdentity'
import { usePayrollRecords }   from './_hooks/usePayrollRecords'

import { PayrollStats }        from '@/components/salary/PayrollStats'
import { PayrollPeriodBar }    from '@/components/salary/PayrollPeriodBar'
import { PayrollFilters }      from '@/components/salary/PayrollFilters'
import { PayrollList }         from '@/components/salary/PayrollList'
import { PayrollEditForm }     from '@/components/salary/PayrollEditForm'
import { SalarySettingsTable } from '@/components/salary/SalarySettingsTable'
import { EmployeeOverrideList } from '@/components/salary/EmployeeOverrideList'
import type { EmployeeSalary } from '@/components/salary/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type TopTab = 'payroll' | 'formula' | 'overrides'

const TABS: { key: TopTab; label: string; directorOnly?: boolean }[] = [
  { key: 'payroll',   label: 'Penggajian' },
  { key: 'formula',   label: 'Formula Gaji',      directorOnly: true },
  { key: 'overrides', label: 'Override Karyawan', directorOnly: true },
]

// ── Toast (local — no context needed for a single-page feature) ───────────────

function useToast(duration = 4000) {
  const [toast, setToast] = useState('')
  // useCallback keeps the reference stable so hooks that depend on showToast
  // don't re-run on every render (which would cause an infinite loading loop).
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), duration)
  }, [duration])
  return { toast, showToast }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { toast, showToast } = useToast()
  const identity = usePayrollIdentity()
  const payroll  = usePayrollRecords({
    role:      identity.role,
    isManager: identity.isManager,
    userId:    identity.userId,
    settings:  identity.settings,
    showToast,
  })

  const [activeTab, setActiveTab] = useState<TopTab>('payroll')

  // ── Overrides tab data (lazy-loaded on first visit) ───────────────────────
  const [overrides, setOverrides] = useState<EmployeeSalary[]>([])
  const [overridesLoading, setOverridesLoading] = useState(false)

  const loadOverrides = useCallback(async () => {
    if (!identity.role) return
    setOverridesLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('employee_salaries')
      .select('*, internal_profiles!staff_id(full_name, role, branch_id, branches!branch_id(name))')
      .order('created_at', { ascending: false })
    setOverrides((data ?? []) as unknown as EmployeeSalary[])
    setOverridesLoading(false)
  }, [identity.role])

  useEffect(() => {
    if (activeTab === 'overrides') loadOverrides()
  }, [activeTab, loadOverrides])

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (!identity.role) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-5 p-4 md:p-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Wallet size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {identity.isManager ? `Penggajian — ${identity.myBranchName ?? ''}` : 'Penggajian'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {identity.isManager
              ? 'Lihat dan kelola penggajian karyawan cabang Anda'
              : 'Kelola formula gaji, override karyawan, dan proses penggajian bulanan'}
          </p>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-2xl w-fit">
        {TABS.filter(t => !t.directorOnly || !identity.isManager).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === t.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-foreground/60 hover:text-foreground hover:bg-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Penggajian ──────────────────────────────────────────────── */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">

          <PayrollPeriodBar
            filters={payroll.filters}
            onFilterChange={payroll.changeFilter}
            isManager={identity.isManager}
            generating={payroll.generating}
            onGenerate={payroll.handleGenerate}
          />

          <PayrollStats
            total={payroll.stats.total}
            draft={payroll.stats.draft}
            confirmed={payroll.stats.confirmed}
            paid={payroll.stats.paid}
          />

          <PayrollFilters
            filters={payroll.filters}
            onFilterChange={payroll.changeFilter}
            stats={payroll.stats}
            branches={identity.branches}
            isManager={identity.isManager}
          />

          {payroll.showForm && (
            <PayrollEditForm
              record={payroll.editRecord}
              form={payroll.form}
              saving={payroll.saving}
              onChange={payroll.setForm}
              onSubmit={payroll.handleSubmit}
              onCancel={payroll.cancelForm}
            />
          )}

          <PayrollList
            records={payroll.records}
            loading={payroll.loading}
            isManager={identity.isManager}
            page={payroll.page}
            total={payroll.total}
            onPageChange={payroll.setPage}
            onConfirm={payroll.handleConfirm}
            onMarkPaid={payroll.handleMarkPaid}
            onEdit={payroll.openEdit}
            onDelete={payroll.handleDelete}
          />

        </div>
      )}

      {/* ── TAB: Formula Gaji ────────────────────────────────────────────── */}
      {activeTab === 'formula' && !identity.isManager && (
        <SalarySettingsTable
          settings={identity.settings}
          onSaved={identity.setSettings}
        />
      )}

      {/* ── TAB: Override Karyawan ───────────────────────────────────────── */}
      {activeTab === 'overrides' && !identity.isManager && (
        overridesLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : (
          <EmployeeOverrideList
            overrides={overrides}
            settings={identity.settings}
            currentUserId={identity.userId ?? ''}
            onUpdated={loadOverrides}
          />
        )
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background text-sm font-medium px-5 py-3 rounded-2xl shadow-xl pointer-events-none">
          {toast}
        </div>
      )}

    </div>
  )
}
