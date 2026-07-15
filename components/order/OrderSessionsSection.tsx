'use client'

import { CalendarClock, Plus, Wand2 } from 'lucide-react'
import { OrderSessionRow } from './OrderSessionRow'
import { inputCls, labelCls } from './constants'
import type { CreateOrderForm, CreateOrderFormErrors, SessionRow, TherapistOption } from './types'

interface Props {
  form: CreateOrderForm
  errors: CreateOrderFormErrors
  therapists: TherapistOption[]
  field: <K extends keyof CreateOrderForm>(key: K, value: CreateOrderForm[K]) => void
  generateSessions: () => void
  addSessionRow: () => void
  removeSessionRow: (key: string) => void
  updateSessionRow: (key: string, patch: Partial<SessionRow>) => void
}

export function OrderSessionsSection({
  form, errors, therapists, field,
  generateSessions, addSessionRow, removeSessionRow, updateSessionRow,
}: Props) {
  const { sessions } = form

  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CalendarClock size={14} className="text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Jadwal Pertemuan</h2>
        <span className="text-destructive text-sm">*</span>
      </div>

      {/* Auto-generate controls */}
      <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <label className={labelCls}>Tanggal Mulai</label>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => field('startDate', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Jumlah Sesi</label>
          <input
            type="number"
            min={1}
            max={52}
            value={form.sessionCount}
            onChange={(e) => field('sessionCount', e.target.value)}
            className={inputCls}
          />
        </div>
        <button
          type="button"
          onClick={generateSessions}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Wand2 size={14} /> Generate Sesi
        </button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Sesi otomatis dijadwalkan mingguan dari tanggal mulai — tiap baris tetap bisa diedit manual.
      </p>

      {errors.sessions && <p className="text-xs text-destructive">{errors.sessions}</p>}

      {sessions.length > 0 && (
        <>
          {/* Desktop / tablet: table */}
          <div className="hidden sm:block rounded-2xl border border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/60 text-left">
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pertemuan</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tanggal</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jam</th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fisioterapis</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <OrderSessionRow
                      key={s.key}
                      variant="table"
                      session={s}
                      therapists={therapists}
                      canRemove={sessions.length > 1}
                      onChange={(patch) => updateSessionRow(s.key, patch)}
                      onRemove={() => removeSessionRow(s.key)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile: stacked cards */}
          <div className="sm:hidden space-y-2.5">
            {sessions.map((s) => (
              <OrderSessionRow
                key={s.key}
                variant="card"
                session={s}
                therapists={therapists}
                canRemove={sessions.length > 1}
                onChange={(patch) => updateSessionRow(s.key, patch)}
                onRemove={() => removeSessionRow(s.key)}
              />
            ))}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={addSessionRow}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
      >
        <Plus size={13} /> Tambah Pertemuan
      </button>
    </div>
  )
}
