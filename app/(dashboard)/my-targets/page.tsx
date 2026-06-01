'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, PlusCircle, Target, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TargetStats } from '@/components/target/TargetStats'
import { TargetForm } from '@/components/target/TargetForm'
import { MyTargetCard } from '@/components/target/MyTargetCard'
import type { TargetRow, StatusFilter } from '@/components/target/types'
import { MONTHS, STATUS_LABEL } from '@/components/target/types'

interface FormState {
  bulan: number
  tahun: number
  target_ta: number
  target_paket_klinik: number
  target_kunjungan: number
  target_visit: number
  notes: string
}

const now = new Date()

function defaultForm(): FormState {
  return {
    bulan: now.getMonth() + 1,
    tahun: now.getFullYear(),
    target_ta: 0,
    target_paket_klinik: 0,
    target_kunjungan: 0,
    target_visit: 0,
    notes: '',
  }
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
]

export default function MyTargetsPage() {
  const [targets, setTargets]       = useState<TargetRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editTarget, setEditTarget] = useState<TargetRow | null>(null)
  const [form, setForm]             = useState<FormState>(defaultForm())
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [activeTab, setActiveTab]   = useState<StatusFilter>('all')
  const [viewYear, setViewYear]     = useState(now.getFullYear())

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('staff_targets')
      .select('id, staff_id, branch_id, bulan, tahun, target_ta, target_paket_klinik, target_kunjungan, target_visit, notes, status, rejection_note, created_at')
      .eq('staff_id', user.id)
      .order('tahun', { ascending: false })
      .order('bulan', { ascending: false })
    setTargets((data ?? []) as unknown as TargetRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditTarget(null)
    setForm(defaultForm())
    setShowForm(true)
  }

  function openEdit(t: TargetRow) {
    setEditTarget(t)
    setForm({
      bulan: t.bulan,
      tahun: t.tahun,
      target_ta: t.target_ta,
      target_paket_klinik: t.target_paket_klinik,
      target_kunjungan: t.target_kunjungan,
      target_visit: t.target_visit,
      notes: t.notes ?? '',
    })
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditTarget(null)
    setForm(defaultForm())
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('branch_id')
      .eq('id', user.id)
      .single()

    const payload = {
      staff_id: user.id,
      branch_id: profile?.branch_id ?? null,
      bulan: form.bulan,
      tahun: form.tahun,
      target_ta: form.target_ta,
      target_paket_klinik: form.target_paket_klinik,
      target_kunjungan: form.target_kunjungan,
      target_visit: form.target_visit,
      notes: form.notes.trim() || null,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }

    let error
    if (editTarget) {
      ;({ error } = await supabase.from('staff_targets').update(payload).eq('id', editTarget.id))
    } else {
      ;({ error } = await supabase.from('staff_targets').insert(payload))
    }

    setSaving(false)
    if (error) {
      console.error('[my-targets] save error:', error)
      if (error.code === '23505') {
        showToast('Sudah ada target untuk bulan/tahun ini. Gunakan tombol Edit.', false)
      } else if (error.code === '23502') {
        showToast('Data profil tidak lengkap. Pastikan cabang sudah diatur.', false)
      } else {
        showToast(`Gagal menyimpan: ${error.message}`, false)
      }
    } else {
      showToast(editTarget ? 'Target berhasil diperbarui.' : 'Target berhasil diajukan!', true)
      cancel()
      load()
    }
  }

  // Derived counts
  const pendingCount  = targets.filter(t => t.status === 'pending').length
  const approvedCount = targets.filter(t => t.status === 'approved').length
  const rejectedCount = targets.filter(t => t.status === 'rejected').length

  const hasCurrentMonth = targets.some(
    t => t.bulan === now.getMonth() + 1 && t.tahun === now.getFullYear(),
  )

  // Filtered for the history list
  const yearTargets = targets.filter(t => t.tahun === viewYear)
  const filtered = activeTab === 'all'
    ? yearTargets
    : yearTargets.filter(t => t.status === activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Target Saya</h1>
          <p className="text-sm text-muted-foreground">Ajukan dan pantau target bulanan Anda</p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-sm"
          >
            <PlusCircle size={15} /> Buat Target
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-sm font-medium ${
          toast.ok
            ? 'bg-chart-4/10 text-chart-4 border border-chart-4/20'
            : 'bg-destructive/10 text-destructive border border-destructive/20'
        }`}>
          {toast.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <TargetForm
          editTarget={editTarget}
          form={form}
          saving={saving}
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancel={cancel}
        />
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse bg-muted rounded-3xl h-20" />)}
        </div>
      ) : (
        <TargetStats stats={{
          total: targets.length,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        }} />
      )}

      {/* Prompt — no target for current month */}
      {!loading && !showForm && !hasCurrentMonth && (
        <div
          onClick={openCreate}
          className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-3xl cursor-pointer hover:bg-primary/10 transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <Target size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Belum ada target untuk {MONTHS[now.getMonth()]} {now.getFullYear()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Klik untuk mengajukan target bulan ini</p>
          </div>
          <PlusCircle size={16} className="text-primary shrink-0" />
        </div>
      )}

      {/* History section */}
      {!loading && targets.length > 0 && (
        <div className="space-y-4">
          {/* Section header + year navigator */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Riwayat Target</h2>
            <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
              <button
                onClick={() => setViewYear(y => y - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-sm font-medium text-foreground min-w-[3rem] text-center">
                {viewYear}
              </span>
              <button
                onClick={() => setViewYear(y => y + 1)}
                disabled={viewYear >= now.getFullYear()}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          {yearTargets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeTab === tab.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {tab.label}
                  {tab.value === 'pending' && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Cards */}
          {yearTargets.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10 bg-muted/30 rounded-3xl">
              Tidak ada target untuk tahun {viewYear}.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-10 bg-muted/30 rounded-3xl">
              Tidak ada target dengan status "{STATUS_LABEL[activeTab]}".
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(t => (
                <MyTargetCard key={t.id} target={t} onEdit={openEdit} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-muted rounded-3xl h-32" />
          ))}
        </div>
      )}

      {/* Empty state — no targets at all */}
      {!loading && targets.length === 0 && (
        <div className="flex flex-col items-center py-16 px-4 bg-muted/30 rounded-3xl gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Target size={22} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Belum ada target yang diajukan</p>
          <p className="text-xs text-muted-foreground text-center">
            Buat target bulanan Anda dan kirim ke direktur untuk disetujui.
          </p>
          <button
            onClick={openCreate}
            className="mt-1 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <PlusCircle size={14} /> Buat Target Pertama
          </button>
        </div>
      )}
    </div>
  )
}
