'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchShiftPatterns, fetchShiftTeams, fetchTeamMembers, fetchStaffOnFlatSchedule,
  saveShiftPattern, saveShiftTeam, assignStaffToTeam, removeStaffFromTeam,
  type ShiftPattern, type ShiftTeam, type ShiftTeamMember,
} from '@/app/actions/rollingShift'
import { PatternDialog } from '@/components/rolling-shift/PatternDialog'
import { TeamDialog } from '@/components/rolling-shift/TeamDialog'
import { TeamMemberManager } from '@/components/rolling-shift/TeamMemberManager'
import { RollingPreviewCalendar } from '@/components/rolling-shift/RollingPreviewCalendar'
import { EMPTY_PATTERN_FORM, type PatternFormState, type TeamFormState, type StaffOption } from '@/components/rolling-shift/types'

const EMPTY_TEAM_FORM: TeamFormState = { name: 'A', pola_x_id: '', pola_y_id: '', anchor_date: '' }

export default function RollingShiftPage() {
  const [role, setRole] = useState<string | null>(null)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null | undefined>(undefined)

  const [patterns, setPatterns] = useState<ShiftPattern[]>([])
  const [teams, setTeams] = useState<ShiftTeam[]>([])
  const [members, setMembers] = useState<Record<string, ShiftTeamMember[]>>({})
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [staffOnFlatSchedule, setStaffOnFlatSchedule] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [patternForm, setPatternForm] = useState<PatternFormState>({ ...EMPTY_PATTERN_FORM })
  const [showPatternDialog, setShowPatternDialog] = useState(false)
  const [editPatternId, setEditPatternId] = useState<string | null>(null)
  const [savingPattern, setSavingPattern] = useState(false)

  const [teamForm, setTeamForm] = useState<TeamFormState>({ ...EMPTY_TEAM_FORM })
  const [showTeamDialog, setShowTeamDialog] = useState(false)
  const [editTeamId, setEditTeamId] = useState<string | null>(null)
  const [savingTeam, setSavingTeam] = useState(false)

  useEffect(() => {
    async function loadMeta() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: profile }, { data: branchList }] = await Promise.all([
        supabase.from('internal_profiles').select('role, branch_id').eq('id', user.id).single(),
        supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
      ])
      setRole(profile?.role ?? null)
      setBranches(branchList ?? [])
      setSelectedBranchId(profile?.branch_id ?? branchList?.[0]?.id ?? null)
    }
    loadMeta()
  }, [])

  useEffect(() => {
    if (!selectedBranchId) { setLoading(false); return }
    load()
  }, [selectedBranchId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!selectedBranchId) return
    setLoading(true)
    const supabase = createClient()
    const [pats, tms, staff, flatIds] = await Promise.all([
      fetchShiftPatterns(selectedBranchId),
      fetchShiftTeams(selectedBranchId),
      supabase.from('internal_profiles').select('id, full_name, branch_id')
        .eq('branch_id', selectedBranchId).in('role', ['therapist', 'staff']).eq('is_active', true).order('full_name'),
      fetchStaffOnFlatSchedule(selectedBranchId),
    ])
    setPatterns(pats)
    setTeams(tms)
    setStaffOptions((staff.data ?? []) as StaffOption[])
    setStaffOnFlatSchedule(flatIds)

    const memberEntries = await Promise.all(tms.map(async (t) => [t.id, await fetchTeamMembers(t.id)] as const))
    setMembers(Object.fromEntries(memberEntries))
    setLoading(false)
  }

  function openAddPattern(code: 'X' | 'Y') {
    setPatternForm({ ...EMPTY_PATTERN_FORM, code })
    setEditPatternId(null)
    setShowPatternDialog(true)
  }

  function openEditPattern(p: ShiftPattern) {
    setPatternForm({
      code: p.code, name: p.name ?? '',
      senin: p.senin, selasa: p.selasa, rabu: p.rabu, kamis: p.kamis, jumat: p.jumat, sabtu: p.sabtu,
    })
    setEditPatternId(p.id)
    setShowPatternDialog(true)
  }

  async function handleSavePattern() {
    if (!selectedBranchId) return
    setSavingPattern(true)
    const { error } = await saveShiftPattern(
      { branch_id: selectedBranchId, ...patternForm, name: patternForm.name || null },
      editPatternId ?? undefined,
    )
    setSavingPattern(false)
    if (error) { alert('Gagal menyimpan: ' + error); return }
    setShowPatternDialog(false)
    load()
  }

  function openAddTeam(name: 'A' | 'B') {
    setTeamForm({ ...EMPTY_TEAM_FORM, name })
    setEditTeamId(null)
    setShowTeamDialog(true)
  }

  function openEditTeam(t: ShiftTeam) {
    setTeamForm({ name: t.name, pola_x_id: t.pola_x_id, pola_y_id: t.pola_y_id, anchor_date: t.anchor_date })
    setEditTeamId(t.id)
    setShowTeamDialog(true)
  }

  async function handleSaveTeam() {
    if (!selectedBranchId) return
    setSavingTeam(true)
    const { error } = await saveShiftTeam(
      { branch_id: selectedBranchId, ...teamForm },
      editTeamId ?? undefined,
    )
    setSavingTeam(false)
    if (error) { alert('Gagal menyimpan: ' + error); return }
    setShowTeamDialog(false)
    load()
  }

  async function handleAssign(teamId: string, staffId: string, effectiveStartDate: string) {
    const { error } = await assignStaffToTeam(teamId, staffId, effectiveStartDate)
    if (error) { alert('Gagal menambah: ' + error); return }
    load()
  }

  async function handleRemove(memberId: string, effectiveEndDate: string) {
    const { error } = await removeStaffFromTeam(memberId, effectiveEndDate)
    if (error) { alert('Gagal menghapus: ' + error); return }
    load()
  }

  const isDirector = role === 'director'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Rolling Shift</h1>
          <p className="text-sm text-muted-foreground">Kelola rotasi Tim A / Tim B per 2 minggu</p>
        </div>
        {isDirector && (
          <select
            value={selectedBranchId ?? ''}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer"
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <>
          {/* Patterns */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Pola Shift (X &amp; Y)</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['X', 'Y'] as const).map((code) => {
                const p = patterns.find((x) => x.code === code)
                return (
                  <div key={code} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground">{p?.name || `Pola ${code}`}</span>
                      <button
                        onClick={() => p ? openEditPattern(p) : openAddPattern(code)}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 cursor-pointer"
                      >
                        {p ? <Pencil size={12} /> : <Plus size={12} />} {p ? 'Edit' : 'Buat'}
                      </button>
                    </div>
                    {p ? (
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {(['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'] as const).map((d) => (
                          <span key={d} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {d.slice(0, 3)}: <span className="text-foreground font-medium">{p[d]}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Belum dibuat</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Teams */}
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Tim A &amp; Tim B</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(['A', 'B'] as const).map((name) => {
                const t = teams.find((x) => x.name === name)
                return (
                  <div key={name} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Tim {name}</span>
                      <button
                        onClick={() => t ? openEditTeam(t) : openAddTeam(name)}
                        disabled={!t && patterns.length < 2}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:text-muted-foreground disabled:cursor-not-allowed cursor-pointer"
                      >
                        {t ? <Pencil size={12} /> : <Plus size={12} />} {t ? 'Edit' : 'Buat'}
                      </button>
                    </div>

                    {!t ? (
                      <p className="text-xs text-muted-foreground">
                        {patterns.length < 2 ? 'Buat Pola X dan Y terlebih dahulu' : 'Belum dibuat'}
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Jangkar: <span className="text-foreground font-medium">{t.anchor_date}</span>
                        </p>
                        <TeamMemberManager
                          teamId={t.id}
                          teamName={t.name}
                          members={members[t.id] ?? []}
                          staffOptions={staffOptions}
                          staffOnFlatSchedule={staffOnFlatSchedule}
                          saving={false}
                          onAssign={handleAssign}
                          onRemove={handleRemove}
                        />
                        <RollingPreviewCalendar teamId={t.id} teamName={t.name} />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      <PatternDialog
        open={showPatternDialog}
        form={patternForm}
        saving={savingPattern}
        isEdit={!!editPatternId}
        onChange={(patch) => setPatternForm((f) => ({ ...f, ...patch }))}
        onSave={handleSavePattern}
        onClose={() => setShowPatternDialog(false)}
      />

      <TeamDialog
        open={showTeamDialog}
        form={teamForm}
        patterns={patterns}
        saving={savingTeam}
        isEdit={!!editTeamId}
        onChange={(patch) => setTeamForm((f) => ({ ...f, ...patch }))}
        onSave={handleSaveTeam}
        onClose={() => setShowTeamDialog(false)}
      />
    </div>
  )
}
