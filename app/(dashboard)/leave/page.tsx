'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/context/ToastContext'
import { uploadErrorMessage } from '@/lib/storageErrors'
import { LeaveStats } from '@/components/leave/LeaveStats'
import { MyLeaveHeader } from '@/components/leave/MyLeaveHeader'
import { MyLeaveForm } from '@/components/leave/MyLeaveForm'
import { MyLeaveList } from '@/components/leave/MyLeaveList'
import type { StatusFilter } from '@/components/leave/types'

interface LeaveRow {
  id: string
  start_date: string
  end_date: string
  reason: string
  proof_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejection_note: string | null
  created_at: string
}

interface FormState {
  start_date: string
  end_date: string
  reason: string
}

const today = new Date().toISOString().split('T')[0]

function defaultForm(): FormState {
  return { start_date: today, end_date: today, reason: '' }
}

export default function MyLeavePage() {
  const [requests, setRequests]           = useState<LeaveRow[]>([])
  const [loading, setLoading]             = useState(true)
  const [activeTab, setActiveTab]         = useState<StatusFilter>('all')
  const [showForm, setShowForm]           = useState(false)
  const [form, setForm]                   = useState<FormState>(defaultForm())
  const [proofFile, setProofFile]         = useState<File | null>(null)
  const [proofPreview, setProofPreview]   = useState('')
  const [saving, setSaving]               = useState(false)
  const { showToast } = useToast()

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('leave_requests')
      .select('id, start_date, end_date, reason, status, rejection_note, proof_url, created_at')
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as LeaveRow[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => () => { if (proofPreview) URL.revokeObjectURL(proofPreview) }, [proofPreview])

  function handleFileChange(file: File | null, preview: string) {
    setProofFile(file)
    setProofPreview(preview)
  }

  function closeForm() {
    setShowForm(false)
    setForm(defaultForm())
    if (proofPreview) URL.revokeObjectURL(proofPreview)
    setProofFile(null)
    setProofPreview('')
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (form.end_date < form.start_date) {
      showToast('Tanggal akhir tidak boleh sebelum tanggal mulai.', 'error')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('branch_id')
      .eq('id', user.id)
      .single()

    let proofUrl: string | null = null
    if (proofFile) {
      const ext = proofFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('leave-proofs')
        .upload(path, proofFile, { upsert: false })
      if (uploadError) {
        setSaving(false)
        showToast(uploadErrorMessage(uploadError.message), 'error')
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('leave-proofs').getPublicUrl(path)
      proofUrl = publicUrl
    }

    const { error } = await supabase.from('leave_requests').insert({
      staff_id: user.id,
      branch_id: profile?.branch_id,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
      proof_url: proofUrl,
    })

    setSaving(false)
    if (error) {
      showToast('Gagal mengajukan cuti.', 'error')
    } else {
      showToast('Pengajuan cuti berhasil dikirim!', 'success')
      closeForm()
      load()
    }
  }

  function handleFileError(msg: string) {
    showToast(msg, 'error')
  }

  const pendingCount  = requests.filter(r => r.status === 'pending').length
  const approvedCount = requests.filter(r => r.status === 'approved').length
  const rejectedCount = requests.filter(r => r.status === 'rejected').length

  return (
    <div className="space-y-6">
      <MyLeaveHeader showForm={showForm} onToggle={() => setShowForm(v => !v)} />

      {showForm && (
        <MyLeaveForm
          form={form}
          proofFile={proofFile}
          proofPreview={proofPreview}
          saving={saving}
          onChange={setForm}
          onFileChange={handleFileChange}
          onFileError={handleFileError}
          onSubmit={handleSubmit}
          onClose={closeForm}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="animate-pulse bg-muted rounded-3xl h-20" />)}
        </div>
      ) : (
        <LeaveStats stats={{
          total: requests.length,
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
        }} />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="animate-pulse bg-muted rounded-3xl h-24" />)}
        </div>
      ) : (
        <MyLeaveList
          requests={requests}
          activeTab={activeTab}
          pendingCount={pendingCount}
          onTabChange={setActiveTab}
          onRequestLeave={() => setShowForm(true)}
        />
      )}
    </div>
  )
}
