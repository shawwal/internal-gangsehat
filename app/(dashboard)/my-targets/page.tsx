'use client'

import { useEffect, useState } from 'react'
import { PlusCircle, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TargetStats } from '@/components/target/TargetStats'
import { TargetForm } from '@/components/target/TargetForm'
import { MyTargetsHeader } from '@/components/target/MyTargetsHeader'
import { MyTargetsToast } from '@/components/target/MyTargetsToast'
import { CurrentMonthPrompt } from '@/components/target/CurrentMonthPrompt'
import { MyTargetsHistory } from '@/components/target/MyTargetsHistory'
import type { TargetRow, StatusFilter } from '@/components/target/types'

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

  const pendingCount  = targets.filter(t => t.status === 'pending').length
  const approvedCount = targets.filter(t => t.status === 'approved').length
  const rejectedCount = targets.filter(t => t.status === 'rejected').length
  const hasCurrentMonth = targets.some(
    t => t.bulan === now.getMonth() + 1 && t.tahun === now.getFullYear(),
  )

  return (
    <div className="space-y-6">
      <MyTargetsHeader showForm={showForm} onCreateClick={openCreate} />

      <MyTargetsToast toast={toast} />

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

      {!loading && !showForm && !hasCurrentMonth && (
        <CurrentMonthPrompt
          month={now.getMonth()}
          year={now.getFullYear()}
          onClick={openCreate}
        />
      )}

      {!loading && targets.length > 0 && (
        <MyTargetsHistory
          targets={targets}
          viewYear={viewYear}
          maxYear={now.getFullYear()}
          activeTab={activeTab}
          pendingCount={pendingCount}
          onYearChange={setViewYear}
          onTabChange={setActiveTab}
          onEdit={openEdit}
        />
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-muted rounded-3xl h-32" />
          ))}
        </div>
      )}

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
