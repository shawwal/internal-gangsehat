'use client'

import './performance-styles.css'
import { useEffect, useState } from 'react'
import { Trophy, Target, Users, Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PerformanceFilters } from '@/components/performance/PerformanceFilters'
import { KontrolTargetTab }   from '@/components/performance/KontrolTargetTab'
import { PerformaStaffTab }   from '@/components/performance/PerformaStaffTab'
import { TerapisTerbaikTab }  from '@/components/performance/TerapisTerbaikTab'
import { CURRENT_YEAR }       from '@/components/performance/utils'
import type { Branch, PerformanceTab } from '@/components/performance/types'

const TABS: { id: PerformanceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'kontrol',  label: 'Kontrol Target', icon: <Target  size={15} /> },
  { id: 'performa', label: 'Performa Staff', icon: <Users   size={15} /> },
  { id: 'terbaik',  label: 'Terapis Terbaik', icon: <Award  size={15} /> },
]

export default function DirectorPerformancePage() {
  const [tab, setTab]                   = useState<PerformanceTab>('kontrol')
  const [year, setYear]                 = useState(CURRENT_YEAR)
  const [branchFilter, setBranchFilter] = useState('all')
  const [branches, setBranches]         = useState<Branch[]>([])

  useEffect(() => {
    createClient()
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setBranches(data ?? []))
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
        >
          <Trophy size={18} color="white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Performa Tim</h1>
          <p className="text-sm text-muted-foreground">
            Kontrol target, performa staff, dan terapis terbaik
          </p>
        </div>
      </div>

      {/* Tab bar + global filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex gap-1 flex-wrap">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  tab === t.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/60 hover:text-foreground hover:bg-muted'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Global filters (year + branch) — hidden in terbaik tab since it has own pickers */}
          {tab !== 'terbaik' && (
            <PerformanceFilters
              year={year}
              setYear={setYear}
              branchFilter={branchFilter}
              setBranchFilter={setBranchFilter}
              branches={branches}
            />
          )}
          {tab === 'terbaik' && (
            /* Only branch filter for terbaik (month/year are inside the tab) */
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className={
                'h-8 px-2.5 rounded-xl text-sm border border-border bg-card text-foreground ' +
                'focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer ' +
                'transition-colors hover:border-primary/50'
              }
            >
              <option value="all">Semua Cabang</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tab content — key triggers re-mount + fade-in animation on tab change */}
      <div key={tab} className="animate-fade-in">
        {tab === 'kontrol'  && <KontrolTargetTab  year={year} branchFilter={branchFilter} />}
        {tab === 'performa' && <PerformaStaffTab  year={year} branchFilter={branchFilter} />}
        {tab === 'terbaik'  && <TerapisTerbaikTab branchFilter={branchFilter} />}
      </div>
    </div>
  )
}
