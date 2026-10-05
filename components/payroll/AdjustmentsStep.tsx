'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ADJUSTMENT_CATEGORY_LABEL, type Adjustment } from '@/lib/payroll/types'
import { staffDisplayName, type PayrollWorkspace } from '@/lib/payroll/workspace'
import { CurrencyInput } from './CurrencyInput'
import { formatRupiah } from './format'
import { Modal, btn, inputCls, labelCls } from './Modal'

interface Props {
  ws: PayrollWorkspace
  onAdd: (input: {
    staffId: string; direction: Adjustment['direction']; category: Adjustment['category']
    amount: number; keterangan: string; internalNote: string
  }) => Promise<boolean>
  onDelete: (id: string) => void
}

const EMPTY = { staffId: '', direction: 'debit' as Adjustment['direction'], category: 'DENDA' as Adjustment['category'], amount: 0, keterangan: '', internalNote: '' }

export function AdjustmentsStep({ ws, onAdd, onDelete }: Props) {
  const editable = ws.permissions.canEdit
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [saving, setSaving] = useState(false)
  const nameOf = (id: string) => {
    const s = ws.staff.find((x) => x.id === id)
    return s ? staffDisplayName(s) : '—'
  }

  const debitTotal = ws.adjustments.filter((a) => a.direction === 'debit').reduce((s, a) => s + a.amount, 0)
  const creditTotal = ws.adjustments.filter((a) => a.direction === 'credit').reduce((s, a) => s + a.amount, 0)

  async function submit() {
    if (!form) return
    setSaving(true)
    const okSaved = await onAdd(form)
    setSaving(false)
    if (okSaved) setForm(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-destructive/10 text-destructive font-medium">Potongan {formatRupiah(debitTotal)}</span>
          <span className="px-3 py-1.5 rounded-xl bg-chart-4/10 text-chart-4 font-medium">Tambahan {formatRupiah(creditTotal)}</span>
        </div>
        {editable && (
          <button className={btn.primary} onClick={() => setForm({ ...EMPTY, staffId: ws.staff[0]?.id ?? '' })}>
            <Plus size={14} /> Tambah denda / bonus
          </button>
        )}
      </div>

      {ws.adjustments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada denda atau bonus manual di periode ini.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {ws.adjustments.map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                a.direction === 'debit' ? 'bg-destructive/10 text-destructive' : 'bg-chart-4/15 text-chart-4'
              }`}>{ADJUSTMENT_CATEGORY_LABEL[a.category]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{nameOf(a.staff_id)}</p>
                <p className="text-xs text-muted-foreground">{a.keterangan}</p>
                {a.internal_note && <p className="text-[11px] text-muted-foreground/80 italic mt-0.5">Catatan internal: {a.internal_note}</p>}
              </div>
              <p className={`text-sm font-semibold whitespace-nowrap ${a.direction === 'debit' ? 'text-destructive' : 'text-chart-4'}`}>
                {a.direction === 'debit' ? '−' : '+'}{formatRupiah(a.amount)}
              </p>
              {editable && (
                <button className={btn.ghost} aria-label="Hapus" onClick={() => onDelete(a.id)}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal
          title="Tambah penyesuaian"
          subtitle="Keterangan tampil di slip gaji; catatan internal hanya untuk audit."
          onClose={() => setForm(null)}
          footer={
            <>
              <button className={btn.secondary} onClick={() => setForm(null)}>Batal</button>
              <button className={btn.primary} onClick={submit} disabled={saving || !form.staffId || form.amount <= 0 || !form.keterangan.trim()}>
                {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Karyawan</label>
              <select className={inputCls} value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
                {ws.staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Jenis</label>
                <select
                  className={inputCls}
                  value={form.direction}
                  onChange={(e) => {
                    const direction = e.target.value as Adjustment['direction']
                    setForm({ ...form, direction, category: direction === 'debit' ? 'DENDA' : 'BONUS' })
                  }}
                >
                  <option value="debit">Potongan</option>
                  <option value="credit">Tambahan</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Kategori</label>
                <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Adjustment['category'] })}>
                  {(form.direction === 'debit' ? ['DENDA', 'KOREKSI', 'LAINNYA'] : ['BONUS', 'KOREKSI', 'LAINNYA']).map((c) => (
                    <option key={c} value={c}>{ADJUSTMENT_CATEGORY_LABEL[c as Adjustment['category']]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Nominal</label>
              <CurrencyInput value={form.amount} onChange={(amount) => setForm({ ...form, amount })} inputClassName="py-2 rounded-xl" />
            </div>
            <div>
              <label className={labelCls}>Keterangan (tampil di slip)</label>
              <input className={inputCls} value={form.keterangan} placeholder="mis. Denda tidak mengikuti family gathering"
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Catatan internal (opsional)</label>
              <textarea className={inputCls} rows={2} value={form.internalNote}
                onChange={(e) => setForm({ ...form, internalNote: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
