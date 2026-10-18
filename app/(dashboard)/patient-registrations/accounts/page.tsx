'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Cake, Link2, Loader2, Phone, Search, UserPlus, UserRoundCheck, XCircle } from 'lucide-react'
import {
  createPatientFromRequest,
  fetchLinkRequests,
  linkRequestToPatient,
  rejectLinkRequest,
  searchUnlinkedPatients,
  type LinkRequestRow,
  type LinkRequestStatus,
} from '@/app/actions/accountLinks'
import { RegistrationTabs } from '@/components/patient-registrations/RegistrationTabs'
import { formatDateTime } from '@/components/patient-registrations/types'
import { ModalShell, NoticeBanner, inputCls, type Notice } from '@/components/rewards/ui'

const STATUS_TABS: { key: LinkRequestStatus; label: string }[] = [
  { key: 'pending', label: 'Menunggu' },
  { key: 'approved', label: 'Terhubung' },
  { key: 'rejected', label: 'Ditolak' },
]

type Dialog =
  | { kind: 'search'; row: LinkRequestRow }
  | { kind: 'create'; row: LinkRequestRow }
  | { kind: 'reject'; row: LinkRequestRow }
  | null

export default function AccountLinkRequestsPage() {
  const [status, setStatus]   = useState<LinkRequestStatus>('pending')
  const [rows, setRows]       = useState<LinkRequestRow[]>([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice]   = useState<Notice | null>(null)
  const [dialog, setDialog]   = useState<Dialog>(null)
  const [busyId, setBusyId]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetchLinkRequests(status)
    setLoading(false)
    if (res.error) { setNotice({ kind: 'error', text: res.error }); return }
    setRows(res.rows)
    setPending(res.pending)
  }, [status])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function link(row: LinkRequestRow, patientId: string, patientName: string) {
    setBusyId(row.id)
    const { error } = await linkRequestToPatient(row.id, patientId)
    setBusyId(null)
    setDialog(null)
    setNotice(error
      ? { kind: 'error', text: error }
      : { kind: 'success', text: `Akun ${row.name} terhubung ke data pasien ${patientName}. Pasien sudah bisa booking online.` })
    await load()
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Link2 size={20} className="text-primary" />
            Hubungkan Akun
          </h1>
          <p className="text-sm text-muted-foreground">
            Pasien gangsehat.com yang No. HP + tanggal lahirnya tidak cocok otomatis meminta akunnya dihubungkan ke data pasien klinik.
            Setelah terhubung, pasien bisa booking jadwal sendiri (paket atau bayar DOKU).
          </p>
        </div>
        <RegistrationTabs pendingAccounts={pending} />
      </div>

      <NoticeBanner notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === t.key ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pending > 0 && <span className="ml-1.5 text-[11px] font-bold">({pending})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">Tidak ada permintaan.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="glass-card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{row.name || '—'}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Phone size={11} /> {row.phone || '—'}</span>
                    <span className="flex items-center gap-1"><Cake size={11} /> {row.birthDate || '—'}</span>
                    {row.branchName && <span>{row.branchName}</span>}
                    <span>{formatDateTime(row.createdAt)}</span>
                  </div>
                  {row.note && <p className="text-xs text-foreground mt-1.5">“{row.note}”</p>}
                </div>
                {row.status !== 'pending' && (
                  <p className="text-xs text-muted-foreground text-right">
                    {row.status === 'approved' ? 'Terhubung' : 'Ditolak'}
                    {row.reviewerName && ` oleh ${row.reviewerName}`}
                    {row.reviewedAt && <span className="block">{formatDateTime(row.reviewedAt)}</span>}
                    {row.matchedPatient && <span className="block text-foreground">→ {row.matchedPatient.name}{row.matchedPatient.noRm && ` (${row.matchedPatient.noRm})`}</span>}
                    {row.rejectionNote && <span className="block text-destructive">{row.rejectionNote}</span>}
                  </p>
                )}
              </div>

              {row.status === 'pending' && (
                <>
                  {row.suggestion && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
                      <p className="text-xs text-foreground">
                        <span className="font-semibold">Kemungkinan cocok (No. HP sama):</span>{' '}
                        {row.suggestion.name}
                        {row.suggestion.noRm && <span className="font-mono"> · {row.suggestion.noRm}</span>}
                        {' '}· lahir {row.suggestion.birthDate || '—'}
                      </p>
                      <button
                        onClick={() => link(row, row.suggestion!.id, row.suggestion!.name)}
                        disabled={busyId === row.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60"
                      >
                        <UserRoundCheck size={13} /> Hubungkan
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setDialog({ kind: 'search', row })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
                    >
                      <Search size={13} /> Cari data pasien
                    </button>
                    <button
                      onClick={() => setDialog({ kind: 'create', row })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
                    >
                      <UserPlus size={13} /> Buat pasien baru
                    </button>
                    <button
                      onClick={() => setDialog({ kind: 'reject', row })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-destructive/10 hover:text-destructive"
                    >
                      <XCircle size={13} /> Tolak
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {dialog?.kind === 'search' && (
        <SearchDialog row={dialog.row} busy={busyId === dialog.row.id} onClose={() => setDialog(null)} onPick={(id, name) => link(dialog.row, id, name)} />
      )}
      {dialog?.kind === 'create' && (
        <CreateDialog
          row={dialog.row}
          onClose={() => setDialog(null)}
          onDone={async (text) => { setDialog(null); setNotice({ kind: 'success', text }); await load() }}
        />
      )}
      {dialog?.kind === 'reject' && (
        <RejectDialog
          row={dialog.row}
          onClose={() => setDialog(null)}
          onDone={async () => { setDialog(null); setNotice({ kind: 'success', text: 'Permintaan ditolak.' }); await load() }}
        />
      )}
    </div>
  )
}

function SearchDialog({ row, busy, onClose, onPick }: {
  row: LinkRequestRow; busy: boolean; onClose: () => void; onPick: (id: string, name: string) => void
}) {
  const [term, setTerm] = useState(row.name)
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchUnlinkedPatients>> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { searchUnlinkedPatients(term).then(setResults) }, 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [term])

  return (
    <ModalShell onClose={onClose} title={`Hubungkan akun ${row.name}`} subtitle={`HP ${row.phone || '—'} · lahir ${row.birthDate || '—'}`}>
      <div className="space-y-3">
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Cari nama atau No. RM…" className={inputCls} autoFocus />
        {results === null ? (
          <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Tidak ada pasien (yang belum terhubung) yang cocok.</p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {results.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.noRm ?? 'Tanpa No. RM'} · lahir {p.birthDate || '—'}</p>
                </div>
                <button
                  onClick={() => onPick(p.id, p.name)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60 shrink-0"
                >
                  Hubungkan
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  )
}

function CreateDialog({ row, onClose, onDone }: { row: LinkRequestRow; onClose: () => void; onDone: (text: string) => void }) {
  const [noRm, setNoRm] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const res = await createPatientFromRequest(row.id, { noRm, gender: gender || null })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onDone(`${row.name} ditambahkan sebagai pasien baru dan akunnya terhubung.`)
  }

  return (
    <ModalShell
      onClose={onClose}
      title="Buat pasien baru"
      subtitle={`${row.name} · HP ${row.phone || '—'} · lahir ${row.birthDate || '—'}`}
      footer={
        <div className="space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted">Batal</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Buat & Hubungkan'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Gunakan ini hanya jika pasien belum pernah terdaftar di klinik.</p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">No. RM (opsional)</span>
          <input value={noRm} onChange={(e) => setNoRm(e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">Jenis kelamin</span>
          <select value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female' | '')} className={inputCls}>
            <option value="">—</option>
            <option value="male">Laki-laki</option>
            <option value="female">Perempuan</option>
          </select>
        </label>
      </div>
    </ModalShell>
  )
}

function RejectDialog({ row, onClose, onDone }: { row: LinkRequestRow; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const res = await rejectLinkRequest(row.id, note)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onDone()
  }

  return (
    <ModalShell
      onClose={onClose}
      title={`Tolak permintaan ${row.name}`}
      footer={
        <div className="space-y-2">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted">Batal</button>
            <button onClick={save} disabled={saving || !note.trim()} className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-medium hover:bg-destructive/90 disabled:opacity-60">
              {saving ? 'Menyimpan...' : 'Tolak'}
            </button>
          </div>
        </div>
      }
    >
      <label className="block space-y-1">
        <span className="text-xs font-medium text-foreground">Alasan</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${inputCls} resize-none`} autoFocus />
      </label>
    </ModalShell>
  )
}
