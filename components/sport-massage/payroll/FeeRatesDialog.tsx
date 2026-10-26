'use client'

import { useState } from 'react'
import { AlertTriangle, BadgeDollarSign, Loader2 } from 'lucide-react'
import {
  saveSportMassageFeeRates,
  type SportMassageFeeRate, type SportMassagePayrollLayanan, type SportMassagePayrollTherapist,
} from '@/app/actions/sportMassagePayroll'
import { rateKey } from './utils'

interface Props {
  branchId: string
  layanan: SportMassagePayrollLayanan[]
  therapists: SportMassagePayrollTherapist[]
  rates: SportMassageFeeRate[]
  onClose: () => void
  onSaved: () => void
}

const DEFAULT_ROW = { id: null as string | null, name: 'Default (semua terapis)' }

const toDigits = (s: string) => s.replace(/\D/g, '')
const fmt = (s: string) => (s ? Number(s).toLocaleString('id-ID') : '')

/** Grid editor: Rp per attended session, per therapist × Layanan; the default row applies when a cell is empty. */
export function FeeRatesDialog({ branchId, layanan, therapists, rates, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(rates.map((r) => [rateKey(r.staff_id, r.layanan_id), String(r.fee)])),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const columns = layanan.filter((l) => l.is_active || rates.some((r) => r.layanan_id === l.id))
  const rows = [DEFAULT_ROW, ...therapists.filter((t) => t.is_active).map((t) => ({ id: t.id as string | null, name: t.name }))]

  async function handleSave() {
    setSaving(true)
    setError(null)
    const out: SportMassageFeeRate[] = []
    for (const row of rows) {
      for (const l of columns) {
        const v = values[rateKey(row.id, l.id)]
        if (v) out.push({ staff_id: row.id, layanan_id: l.id, fee: Number(v) })
      }
    }
    // Keep rates of therapists / Layanan not shown here (inactive) untouched.
    const visibleKeys = new Set(rows.flatMap((row) => columns.map((l) => rateKey(row.id, l.id))))
    for (const r of rates) if (!visibleKeys.has(rateKey(r.staff_id, r.layanan_id))) out.push(r)
    const res = await saveSportMassageFeeRates(branchId, out)
    setSaving(false)
    if (!res.ok) { setError(res.error); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={saving ? undefined : onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-4xl shadow-2xl max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <BadgeDollarSign size={16} className="text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Tarif Fee Sport Massage</p>
            <p className="text-xs text-muted-foreground">
              Rp per sesi <b>hadir</b>. Kosongkan sel terapis untuk memakai tarif Default.
            </p>
          </div>
        </div>

        <div className="p-5 overflow-auto">
          {columns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Belum ada Layanan Sport Massage di cabang ini. Tambahkan di menu Layanan.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground sticky left-0 bg-card">Terapis</th>
                  {columns.map((l) => (
                    <th key={l.id} className="px-2 py-2 text-left text-xs font-medium text-muted-foreground min-w-32">
                      <span className="block text-foreground">{l.nama}</span>
                      <span className="block text-[10px] font-normal">{l.kategori}{!l.is_active && ' · nonaktif'}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id ?? 'default'} className={`border-b border-border/40 last:border-0 ${row.id ? '' : 'bg-primary/5'}`}>
                    <td className="px-2 py-1.5 text-xs font-medium text-foreground whitespace-nowrap sticky left-0 bg-card">{row.name}</td>
                    {columns.map((l) => {
                      const k = rateKey(row.id, l.id)
                      const fallback = row.id ? values[rateKey(null, l.id)] : undefined
                      return (
                        <td key={l.id} className="px-2 py-1.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">Rp</span>
                            <input
                              inputMode="numeric"
                              value={fmt(values[k] ?? '')}
                              placeholder={fallback ? fmt(fallback) : '0'}
                              onChange={(e) => setValues((v) => ({ ...v, [k]: toDigits(e.target.value) }))}
                              className="w-full pl-8 pr-2 py-1.5 border border-border rounded-lg text-xs bg-input text-right font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-1.5 p-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertTriangle size={13} className="text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || columns.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Menyimpan...</> : 'Simpan Tarif'}
          </button>
        </div>
      </div>
    </div>
  )
}
