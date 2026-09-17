'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, GraduationCap, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveGriyaBranchId, fetchGriyaMasterSchedule, removeSlot, type GriyaSlot } from '@/app/actions/griyaJadwal'
import { HARI_ORDER, HARI_LABEL, DISCIPLINE_LABEL, toIso } from '@/components/griya/constants'
import { AddMasterScheduleDialog } from '@/components/griya/master/AddMasterScheduleDialog'
import { EditMasterScheduleDialog } from '@/components/griya/master/EditMasterScheduleDialog'
import { EndEnrollmentDialog } from '@/components/griya/EndEnrollmentDialog'
import { useToast } from '@/context/ToastContext'
import type { CellTarget } from '@/components/griya/types'

export default function GriyaJadwalMasterPage() {
  const { showToast } = useToast()
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [canEdit, setCanEdit] = useState(false)

  const [rows, setRows] = useState<GriyaSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<GriyaSlot | null>(null)
  const [ending, setEnding] = useState<GriyaSlot | null>(null)

  useEffect(() => {
    (async () => {
      const bid = await resolveGriyaBranchId()
      setBranchId(bid)
      if (!bid) { setEnabled(false); return }
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('internal_profiles').select('role').eq('id', user!.id).single()
      setCanEdit(['director', 'manager', 'admin'].includes(profile?.role ?? ''))
      const { data: s } = await supabase.from('branch_griya_settings').select('enabled').eq('branch_id', bid).maybeSingle()
      setEnabled(profile?.role === 'director' ? true : (s?.enabled ?? false))
    })()
  }, [])

  const load = useCallback(() => {
    if (!branchId) return
    setLoading(true)
    fetchGriyaMasterSchedule(branchId).then((r) => { setRows(r); setLoading(false) })
  }, [branchId])
  useEffect(() => { load() }, [load])

  async function handleDelete(row: GriyaSlot) {
    if (!confirm(`Hapus jadwal tetap ${row.patient_name} (${HARI_LABEL[row.hari]} ${row.slot_time})?`)) return
    const { error } = await removeSlot(row.id)
    if (error) showToast(error, 'error')
    else { showToast('Jadwal dihapus', 'success'); load() }
  }

  function targetFor(row: GriyaSlot): CellTarget {
    return {
      therapistId: '', therapistName: '', discipline: row.discipline, hari: row.hari, hour: row.slot_time,
      dateIso: toIso(new Date()), branchId: branchId!, slot: row, visit: null,
    }
  }

  if (branchId === undefined || enabled === null) return <div className="text-sm text-muted-foreground">Memuat...</div>
  if (!branchId || !enabled) return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Griya Anak belum aktif untuk cabang ini.</div>

  const grouped = HARI_ORDER.map((h) => ({ hari: h, rows: rows.filter((r) => r.hari === h).sort((a, b) => a.slot_time.localeCompare(b.slot_time)) }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Jadwal Master Griya Anak</h1>
          <p className="text-sm text-muted-foreground">Jadwal tetap anak — Hari, Jam, Siswa, Layanan. Terapis ditentukan otomatis tiap hari di Jadwal Griya Anak.</p>
        </div>
        {canEdit && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 cursor-pointer">
            <Plus size={14} /> Tambah Jadwal
          </button>
        )}
      </div>

      {loading ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">Memuat...</div>
      ) : rows.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">Belum ada jadwal master.</div>
      ) : (
        <div className="space-y-4">
          {grouped.filter((g) => g.rows.length > 0).map((g) => (
            <div key={g.hari} className="glass-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-muted/30">
                <h2 className="text-sm font-semibold text-foreground">{HARI_LABEL[g.hari]}</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Jam</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Siswa</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Layanan</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Kategori</th>
                    {canEdit && <th className="px-4 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{r.slot_time}</td>
                      <td className="px-4 py-2 font-medium">{r.patient_name}</td>
                      <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{DISCIPLINE_LABEL[r.discipline]}</td>
                      <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">{r.service_type ?? '—'}</td>
                      {canEdit && (
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button onClick={() => setEditing(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer" title="Ubah">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setEnding(r)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer" title="Akhiri jadwal">
                            <GraduationCap size={13} />
                          </button>
                          <button onClick={() => handleDelete(r)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive cursor-pointer" title="Hapus">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddMasterScheduleDialog branchId={branchId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); showToast('Jadwal ditambahkan', 'success'); load() }} />
      )}
      {editing && (
        <EditMasterScheduleDialog slot={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); showToast('Jadwal diperbarui', 'success'); load() }} />
      )}
      {ending && (
        <EndEnrollmentDialog target={targetFor(ending)} onClose={() => setEnding(null)} onSaved={() => { setEnding(null); showToast('Jadwal diakhiri', 'success'); load() }} />
      )}
    </div>
  )
}
