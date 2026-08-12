'use client'

import { useState } from 'react'
import { Pencil, Trash2, ChevronDown, ChevronUp, CalendarDays, Wallet, OctagonMinus } from 'lucide-react'
import { fetchPackageSessions } from '@/app/actions/packages'
import { fetchOrderPaymentHistory } from '@/app/actions/transactions'
import { fetchBranchStaff, fetchVisitWithPatient, updateVisit, deleteVisit, type BranchStaffMember, type VisitWithPatient } from '@/app/actions/jadwal'
import { fetchBookingIdByKode } from '@/app/actions/orders'
import type { PatientPackageWithPayment } from '@/app/actions/packages'
import type { OrderPaymentHistoryEntry } from '@/lib/internal/orderPayments'
import { SessionList } from './SessionList'
import { PaymentHistoryTable } from '@/components/finance/PaymentHistoryTable'
import { ConfirmDialog } from '@/components/leave/ConfirmDialog'
import {
  OP_STATUS_BADGE, STATUS_BADGE, STATUS_LABEL, COMPLETION_BADGE, COMPLETION_LABEL, INPUT_CLS, LABEL_CLS,
} from './types'
import { formatDate, formatCurrency, sessionBarColor, sessionTextColor, extractKodeTransaksi } from './helpers'
import type { PatientPackage, PackageSession } from './types'
import type { ServiceType, UserRole } from '@/types'

const SESSION_SERVICE_TYPES: ServiceType[] = [
  'TERAPI AWAL', 'PAKET TERAPI', 'SESI TERAPI',
  'TA VISIT', 'SESI VISIT', 'PAKET VISIT', 'SPORT MASSAGE', 'LAINNYA',
]

type EditSessionForm = {
  visit_date:          string
  attending_staff_id:  string
  service_type:        ServiceType | ''
  shift:                'PAGI' | 'SORE' | ''
  kehadiran:            'HADIR' | 'TIDAK HADIR' | ''
  sumber_pasien:        string
}

function toEditSessionForm(v: VisitWithPatient): EditSessionForm {
  return {
    visit_date:         v.visit_date,
    attending_staff_id: v.attending_staff_id ?? '',
    service_type:       (v.service_type as ServiceType) ?? '',
    shift:              (v.shift as EditSessionForm['shift']) ?? '',
    kehadiran:          (v.kehadiran as EditSessionForm['kehadiran']) ?? '',
    sumber_pasien:       v.sumber_pasien ?? '',
  }
}

interface PackageCardProps {
  pkg:        PatientPackageWithPayment
  userRole:   UserRole | null
  onEdit:     (pkg: PatientPackage) => void
  onDelete:   (id: string) => void
  onStop:     (id: string) => void
  onSchedule?: (pkg: PatientPackage) => void
  onSessionChange: () => void
}

export function PackageCard({ pkg, userRole, onEdit, onDelete, onStop, onSchedule, onSessionChange }: PackageCardProps) {
  const pct = pkg.total_sessions > 0 ? (pkg.used_sessions / pkg.total_sessions) * 100 : 0
  const [expanded, setExpanded]             = useState(false)
  const [sessions, setSessions]             = useState<PackageSession[] | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)

  const [paymentExpanded, setPaymentExpanded] = useState(false)
  const [paymentHistory, setPaymentHistory]   = useState<OrderPaymentHistoryEntry[] | null>(null)
  const [loadingPayments, setLoadingPayments] = useState(false)

  const [branchStaff, setBranchStaff]           = useState<BranchStaffMember[]>([])
  const [editSessionTarget, setEditSessionTarget] = useState<VisitWithPatient | null>(null)
  const [editSessionForm, setEditSessionForm]     = useState<EditSessionForm | null>(null)
  const [editSessionSaving, setEditSessionSaving] = useState(false)

  const [deleteSessionTarget, setDeleteSessionTarget] = useState<PackageSession | null>(null)
  const [deleteSessionSaving, setDeleteSessionSaving] = useState(false)
  const [deleteSessionError, setDeleteSessionError]   = useState<string | null>(null)

  const [resolvingOrder, setResolvingOrder] = useState(false)

  const canDeleteSession = !!userRole && !['therapist', 'staff', 'sport_massage_therapist'].includes(userRole)
  const kodeTransaksi = extractKodeTransaksi(pkg.notes)

  async function handleOpenOrder() {
    if (!kodeTransaksi) return
    setResolvingOrder(true)
    const bookingId = await fetchBookingIdByKode(kodeTransaksi)
    setResolvingOrder(false)
    if (!bookingId) { alert('Order tidak ditemukan untuk kode ini.'); return }
    window.open(`/order/${bookingId}`, '_blank', 'noopener,noreferrer')
  }

  async function toggleSessions() {
    if (!expanded && sessions === null) {
      setLoadingSessions(true)
      const data = await fetchPackageSessions(pkg.id)
      setSessions(data)
      setLoadingSessions(false)
    }
    setExpanded((v) => !v)
  }

  async function refreshSessions() {
    const data = await fetchPackageSessions(pkg.id)
    setSessions(data)
    onSessionChange()
  }

  async function togglePayments() {
    if (!paymentExpanded && paymentHistory === null && pkg.order_id) {
      setLoadingPayments(true)
      const summary = await fetchOrderPaymentHistory(pkg.order_id)
      setPaymentHistory(summary.history)
      setLoadingPayments(false)
    }
    setPaymentExpanded((v) => !v)
  }

  async function openEditSession(s: PackageSession) {
    const v = await fetchVisitWithPatient(s.id)
    if (!v) return
    setEditSessionTarget(v)
    setEditSessionForm(toEditSessionForm(v))
    if (branchStaff.length === 0 && pkg.branch_id) {
      fetchBranchStaff(pkg.branch_id).then(setBranchStaff)
    }
  }

  async function handleEditSessionSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editSessionTarget || !editSessionForm) return
    setEditSessionSaving(true)
    const { error } = await updateVisit(editSessionTarget.id, {
      visit_date:          editSessionForm.visit_date,
      attending_staff_id:  editSessionForm.attending_staff_id || null,
      service_type:        editSessionForm.service_type || null,
      shift:                editSessionForm.shift || null,
      kehadiran:            editSessionForm.kehadiran || null,
      sumber_pasien:        editSessionForm.sumber_pasien || null,
    })
    setEditSessionSaving(false)
    if (error) { alert(error); return }
    setEditSessionTarget(null)
    setEditSessionForm(null)
    await refreshSessions()
  }

  async function handleDeleteSession() {
    if (!deleteSessionTarget) return
    setDeleteSessionSaving(true)
    setDeleteSessionError(null)
    const { error } = await deleteVisit(deleteSessionTarget.id)
    setDeleteSessionSaving(false)
    if (error) {
      setDeleteSessionError(
        error.includes('foreign key')
          ? 'Sesi ini memiliki data terkait (pembayaran/rekam medis) dan tidak dapat dihapus.'
          : error
      )
      return
    }
    setDeleteSessionTarget(null)
    await refreshSessions()
  }

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground truncate">{pkg.package_name}</span>
            {pkg.jenis_paket && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                {pkg.jenis_paket}
              </span>
            )}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${OP_STATUS_BADGE[pkg.operational_status]}`}>
              {pkg.operational_status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[pkg.status]}`}>
              {STATUS_LABEL[pkg.status]}
            </span>
            {pkg.mulai_paket && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border font-medium">
                {pkg.mulai_paket}
              </span>
            )}
            {pkg.completion_status && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${COMPLETION_BADGE[pkg.completion_status]}`}>
                {COMPLETION_LABEL[pkg.completion_status]}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onSchedule && pkg.status === 'active' && pkg.remaining_sessions > 0 && (
            <button
              onClick={() => onSchedule(pkg)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors border border-primary/20"
              title="Jadwalkan sesi"
            >
              <CalendarDays size={12} />
              Jadwalkan
            </button>
          )}
          <button
            onClick={() => onEdit(pkg)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          {pkg.status === 'active' && (
            <button
              onClick={() => onStop(pkg.id)}
              className="p-1.5 rounded-lg hover:bg-secondary/10 text-muted-foreground hover:text-secondary transition-colors"
              title="Stop order — wajib sebelum bisa buat order baru untuk pasien ini"
            >
              <OctagonMinus size={14} />
            </button>
          )}
          {pkg.status === 'active' && (
            <button
              onClick={() => onDelete(pkg.id)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Batalkan"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Payment info */}
      {pkg.payment ? (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Wallet size={12} />
            {formatCurrency(pkg.payment.harga ?? 0)}
            {pkg.payment.transactionStatus === 'pending' && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#FFB35C]/15 text-[#FFB35C] border border-[#FFB35C]/25">
                Menunggu Konfirmasi
              </span>
            )}
          </span>
          <span className={`font-semibold px-2 py-0.5 rounded-full border ${
            pkg.payment.paymentStatus === 'LUNAS'
              ? 'bg-[#34C759]/15 text-[#34C759] border-[#34C759]/20'
              : 'bg-[#FFB35C]/15 text-[#FFB35C] border-[#FFB35C]/25'
          }`}>
            {pkg.payment.paymentStatus === 'LUNAS' ? 'Lunas' : `Sisa ${formatCurrency(pkg.payment.outstanding)}`}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 text-xs text-destructive">
          <Wallet size={12} />
          Belum ada pembayaran tercatat untuk paket ini
        </div>
      )}

      {/* Session progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{pkg.used_sessions} dari {pkg.total_sessions} sesi digunakan</span>
          <span className={`font-semibold ${sessionTextColor(pkg.remaining_sessions)}`}>
            {pkg.remaining_sessions} sesi tersisa
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${sessionBarColor(pkg.remaining_sessions, pkg.total_sessions)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Session drill-down toggle */}
      <button
        onClick={toggleSessions}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-xs text-muted-foreground"
      >
        <span>Riwayat Sesi</span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="rounded-xl border border-border overflow-hidden">
          <SessionList
            sessions={sessions}
            loading={loadingSessions}
            onEdit={openEditSession}
            onDelete={(s) => { setDeleteSessionTarget(s); setDeleteSessionError(null) }}
            canDelete={canDeleteSession}
          />
        </div>
      )}

      {pkg.order_id && (
        <>
          <button
            onClick={togglePayments}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-xs text-muted-foreground"
          >
            <span>Riwayat Pembayaran</span>
            {paymentExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {paymentExpanded && (
            loadingPayments
              ? <p className="text-xs text-muted-foreground px-1">Memuat...</p>
              : <PaymentHistoryTable history={paymentHistory ?? []} />
          )}
        </>
      )}

      {pkg.status === 'stopped' && pkg.stopped_at && (
        <p className="text-[10px] text-muted-foreground">Dihentikan pada {formatDate(pkg.stopped_at)}</p>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        {pkg.notes ? (
          kodeTransaksi ? (
            <button
              onClick={handleOpenOrder}
              disabled={resolvingOrder}
              className="text-xs text-primary hover:underline truncate max-w-[60%] text-left disabled:opacity-60"
              title="Buka order di tab baru"
            >
              {resolvingOrder ? 'Membuka...' : pkg.notes}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground truncate max-w-[60%]">{pkg.notes}</p>
          )
        ) : (
          <span />
        )}
        <p className="text-[10px] text-muted-foreground/60 shrink-0">{formatDate(pkg.created_at)}</p>
      </div>

      {/* Edit session modal — mirrors visits/page.tsx's session edit scope:
          visit_date, terapis, layanan, shift, kehadiran, sumber pasien. */}
      {editSessionTarget && editSessionForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setEditSessionTarget(null); setEditSessionForm(null) }}>
          <div
            className="bg-card rounded-2xl border border-border w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-sm font-semibold text-foreground">Edit Sesi</h2>
              <button onClick={() => { setEditSessionTarget(null); setEditSessionForm(null) }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors text-lg leading-none">×</button>
            </div>

            <form id="edit-session-form" onSubmit={handleEditSessionSave} className="flex-1 overflow-y-auto p-5 space-y-3">
              {branchStaff.length > 0 && (
                <div>
                  <label className={LABEL_CLS}>Terapis / Staff</label>
                  <select
                    value={editSessionForm.attending_staff_id}
                    onChange={(e) => setEditSessionForm((f) => f && { ...f, attending_staff_id: e.target.value })}
                    className={INPUT_CLS}
                  >
                    <option value="">— Belum ditentukan —</option>
                    {branchStaff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Tanggal</label>
                  <input required type="date" value={editSessionForm.visit_date}
                    onChange={(e) => setEditSessionForm((f) => f && { ...f, visit_date: e.target.value })}
                    className={INPUT_CLS} />
                </div>
                <div>
                  <label className={LABEL_CLS}>Shift</label>
                  <select
                    value={editSessionForm.shift}
                    onChange={(e) => setEditSessionForm((f) => f && { ...f, shift: e.target.value as EditSessionForm['shift'] })}
                    className={INPUT_CLS}
                  >
                    <option value="">— Pilih —</option>
                    <option value="PAGI">PAGI</option>
                    <option value="SORE">SORE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_CLS}>Layanan</label>
                  <select value={editSessionForm.service_type} onChange={(e) => setEditSessionForm((f) => f && { ...f, service_type: e.target.value as ServiceType | '' })} className={INPUT_CLS}>
                    <option value="">— Pilih —</option>
                    {SESSION_SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Kehadiran</label>
                  <select value={editSessionForm.kehadiran} onChange={(e) => setEditSessionForm((f) => f && { ...f, kehadiran: e.target.value as EditSessionForm['kehadiran'] })} className={INPUT_CLS}>
                    <option value="">— Pilih —</option>
                    <option value="HADIR">HADIR</option>
                    <option value="TIDAK HADIR">TIDAK HADIR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={LABEL_CLS}>Sumber Pasien</label>
                <input value={editSessionForm.sumber_pasien} onChange={(e) => setEditSessionForm((f) => f && { ...f, sumber_pasien: e.target.value })}
                  placeholder="mis. Rekomendasi, sosial media"
                  className={INPUT_CLS} />
              </div>
            </form>

            <div className="flex gap-2 px-5 py-4 border-t border-border shrink-0">
              <button type="button" onClick={() => { setEditSessionTarget(null); setEditSessionForm(null) }}
                className="flex-1 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
                Batal
              </button>
              <button type="submit" form="edit-session-form" disabled={editSessionSaving}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {editSessionSaving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete session confirmation */}
      {deleteSessionTarget && (
        <ConfirmDialog
          title="Hapus Sesi"
          description={
            deleteSessionError ??
            `Hapus sesi tanggal ${formatDate(deleteSessionTarget.visit_date)} (${deleteSessionTarget.service_type})? Tindakan ini tidak dapat dibatalkan.`
          }
          confirmLabel="Hapus"
          danger
          loading={deleteSessionSaving}
          onConfirm={handleDeleteSession}
          onCancel={() => { setDeleteSessionTarget(null); setDeleteSessionError(null) }}
        />
      )}
    </div>
  )
}
