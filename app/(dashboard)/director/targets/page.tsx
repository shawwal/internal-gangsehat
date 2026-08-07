'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

import { StaffTargetsPanel } from '@/components/target/StaffTargetsPanel'
import { BranchTargetsPanel } from '@/components/target/BranchTargetsPanel'
import { CategorySettingsPanel } from '@/components/target/CategorySettingsPanel'
import { useStaffTargets } from '@/components/target/useStaffTargets'
import { useBranchTargets } from '@/components/target/useBranchTargets'
import { useBranchCategorySettings } from '@/components/target/useBranchCategorySettings'
import type { BranchOption } from '@/components/target/types'

type TopTab = 'branch' | 'staff' | 'kategori'

const now = new Date()

export default function DirectorTargetsPage() {
  // ── Role detection ─────────────────────────────────────────────────────
  const [role, setRole]                 = useState<'director' | 'manager' | null>(null)
  const [myBranchId, setMyBranchId]     = useState<string | null>(null)
  const [myBranchName, setMyBranchName] = useState<string>('')

  // ── Shared ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TopTab>('branch')
  const [branches, setBranches]   = useState<BranchOption[]>([])

  const todayLabel = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // ── Init: detect role + load branches ─────────────────────────────────
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('internal_profiles')
        .select('role, branch_id, branches!branch_id(name)')
        .eq('id', user.id)
        .single()

      if (!profile) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = profile as any
      setRole(p.role)
      setMyBranchId(p.branch_id ?? null)
      setMyBranchName(p.branches?.name ?? '')

      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
      setBranches((branchData ?? []) as BranchOption[])
    }
    init()
  }, [])

  const isManager = role === 'manager'

  const staffTargets  = useStaffTargets()
  const branchTargets = useBranchTargets(role, myBranchId)

  // Category settings scope: director sees/edits every branch, manager only their own.
  const categoryBranches = useMemo(
    () => isManager
      ? branches.filter(b => b.id === myBranchId)
      : branches,
    [branches, isManager, myBranchId],
  )
  const categoryBranchIds = useMemo(
    () => categoryBranches.map(b => b.id),
    [categoryBranches],
  )
  const categorySettings = useBranchCategorySettings(categoryBranchIds)

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {isManager ? `Target — ${myBranchName || '...'}` : 'Target'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? 'Ajukan dan pantau target cabang Anda'
              : 'Tinjau dan setujui target bulanan seluruh cabang'}
          </p>
        </div>
        <span className="text-xs bg-muted px-3 py-1.5 rounded-2xl text-muted-foreground shrink-0">
          {todayLabel}
        </span>
      </div>

      {/* Top-level tabs — only after role is known */}
      {role !== null && (
        <div className="flex gap-2">
          {([
            { value: 'branch' as TopTab, label: 'Target Cabang' },
            { value: 'staff' as TopTab, label: 'Target Staff' },
            { value: 'kategori' as TopTab, label: 'Kategori' },
          ] as const).map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-foreground/60 hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
              {tab.value === 'staff' && staffTargets.stats.pending > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-destructive/80 text-white text-[10px] font-bold leading-none">
                  {staffTargets.stats.pending > 9 ? '9+' : staffTargets.stats.pending}
                </span>
              )}
              {tab.value === 'branch' && branchTargets.stats.pending > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-destructive/80 text-white text-[10px] font-bold leading-none">
                  {branchTargets.stats.pending > 9 ? '9+' : branchTargets.stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'staff' && (
        <StaffTargetsPanel branches={branches} state={staffTargets} />
      )}

      {activeTab === 'branch' && (
        <BranchTargetsPanel
          branches={branches}
          disabledCategories={categorySettings.disabled}
          state={branchTargets}
        />
      )}

      {activeTab === 'kategori' && (
        <CategorySettingsPanel
          branches={categoryBranches}
          disabled={categorySettings.disabled}
          loading={categorySettings.loading}
          onToggle={categorySettings.toggle}
        />
      )}
    </div>
  )
}
