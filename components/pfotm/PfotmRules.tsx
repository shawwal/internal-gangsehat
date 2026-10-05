'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { PointRule } from '@/lib/pfotm/engine'
import { Modal, btn, inputCls, labelCls } from '@/components/payroll/Modal'

interface Props {
  rules: PointRule[]
  editable: boolean
  onSave: (input: { metric_key: string; metric_label: string; weight: number; is_active: boolean; isNew?: boolean }) => Promise<boolean>
}

/** Admin panel for the Point_Rules table — multipliers are never hardcoded. */
export function PfotmRules({ rules, editable, onSave }: Props) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<{ metric_key: string; metric_label: string; weight: number } | null>(null)

  async function commit(r: PointRule, raw: string) {
    setDrafts((d) => { const next = { ...d }; delete next[r.metric_key]; return next })
    const weight = Number(raw.replace(',', '.'))
    if (!Number.isFinite(weight) || weight === Number(r.weight)) return
    await onSave({ metric_key: r.metric_key, metric_label: r.metric_label, weight, is_active: r.is_active !== false })
  }

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Perubahan bobot langsung berlaku untuk periode yang belum dikunci. Periode terkunci tetap memakai bobot saat dikunci.
        </p>
        {editable && <button className={btn.secondary} onClick={() => setAdding({ metric_key: '', metric_label: '', weight: 1 })}><Plus size={14} /> Metrik</button>}
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {rules.map((r) => (
          <div key={r.metric_key} className={`flex items-center gap-3 px-4 py-3 ${r.is_active === false ? 'opacity-50' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{r.metric_label}</p>
              <p className="text-[11px] text-muted-foreground">
                <span className="font-mono">{r.metric_key}</span> · {r.source === 'manual' ? 'input manual' : 'otomatis'}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">×</span>
            <input
              disabled={!editable}
              value={drafts[r.metric_key] ?? String(Number(r.weight))}
              onChange={(e) => setDrafts((d) => ({ ...d, [r.metric_key]: e.target.value }))}
              onBlur={(e) => { if (drafts[r.metric_key] !== undefined) commit(r, e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              aria-label={`Bobot ${r.metric_label}`}
              className={`w-20 px-2 py-1.5 rounded-lg border border-border bg-background text-center font-bold ${Number(r.weight) < 0 ? 'text-destructive' : 'text-foreground'}`}
            />
            {editable && (
              <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" className="accent-[var(--primary)]" checked={r.is_active !== false}
                  onChange={(e) => onSave({ metric_key: r.metric_key, metric_label: r.metric_label, weight: Number(r.weight), is_active: e.target.checked })} />
                aktif
              </label>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <Modal title="Metrik baru" subtitle="Metrik baru diisi manual oleh HR di form input." onClose={() => setAdding(null)} size="sm"
          footer={
            <>
              <button className={btn.secondary} onClick={() => setAdding(null)}>Batal</button>
              <button className={btn.primary} disabled={!adding.metric_key || !adding.metric_label}
                onClick={async () => { if (await onSave({ ...adding, is_active: true, isNew: true })) setAdding(null) }}>Simpan</button>
            </>
          }>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Nama metrik</label>
              <input className={inputCls} value={adding.metric_label} placeholder="mis. Review Google"
                onChange={(e) => setAdding({ ...adding, metric_label: e.target.value, metric_key: adding.metric_key || '' })} />
            </div>
            <div>
              <label className={labelCls}>Kode (huruf kecil, tanpa spasi)</label>
              <input className={inputCls} value={adding.metric_key} placeholder="review_google"
                onChange={(e) => setAdding({ ...adding, metric_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} />
            </div>
            <div>
              <label className={labelCls}>Bobot (negatif = penalti)</label>
              <input type="number" step="0.5" className={inputCls} value={adding.weight} onChange={(e) => setAdding({ ...adding, weight: Number(e.target.value) })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
