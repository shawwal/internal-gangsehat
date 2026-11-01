'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { ActivityType, Compensation } from '@/lib/payroll/types'
import { activityDisplay, sortActivityTypes } from '@/lib/payroll/activityDisplay'
import { incentiveConfigIssue } from '@/lib/payroll/engine'
import { CurrencyInput } from '../CurrencyInput'
import { inputCls, labelCls } from '../Modal'

export const EMPTY_COMPENSATION: Compensation = {
  gaji_pokok: 0, tj_jabatan: 0, operasional: 0, operasional_mode: 'prorata', operasional_threshold: 0.75,
  operasional_daily_rate: 100000, insentif_base: 0, incentive_target: 0, incentive_full_threshold: 1, incentive_activity_codes: [],
  bonus_tiers: [], activity_rates: {},
}

/** Starting points matching the legacy ID sheet's three pay schemes, plus the Griya Anak sheet's two. */
export const PRESETS: { key: string; label: string; apply: (c: Compensation) => Compensation }[] = [
  {
    key: 'fisio',
    label: 'Fisioterapis',
    apply: (c) => ({
      ...c, operasional_mode: 'prorata', operasional_threshold: 0.75, incentive_target: 60, incentive_full_threshold: 1,
      incentive_activity_codes: ['PAKET_KLINIK', 'SESI_KLINIK', 'TERAPI_AWAL_KLINIK'],
      activity_rates: { PAKET_VISIT: 900000, SESI_VISIT: 100000, TERAPI_AWAL_VISIT: 150000, JARAK_VISIT: 50000, ...c.activity_rates },
    }),
  },
  {
    key: 'masseur',
    label: 'Masseur (Sport Massage)',
    apply: (c) => ({
      ...c, operasional_mode: 'daily_deduction', operasional_daily_rate: 100000, incentive_target: 39, incentive_full_threshold: 1,
      incentive_activity_codes: ['SPORT_MASSAGE_FULL_BODY', 'SPORT_MASSAGE_SEGMENTAL'],
      bonus_tiers: [{ min_qty: 40, amount: 200000, label: 'Bonus Insentif 1' }, { min_qty: 70, amount: 200000, label: 'Bonus Insentif 2' }],
      activity_rates: { SPORT_MASSAGE_VISIT_FULL_BODY: 150000, SPORT_MASSAGE_VISIT_SEGMENTAL: 95000, PAKET_SPORT_MASSAGE_VISIT_FULL_BODY: 285000, PAKET_SPORT_MASSAGE_VISIT_SEGMENTAL: 270000, JARAK_SPORT_MASSAGE_VISIT: 50000, ...c.activity_rates },
    }),
  },
  {
    key: 'staf',
    label: 'Staf / Admin',
    apply: (c) => ({ ...c, operasional_mode: 'prorata', operasional_threshold: 0.75 }),
  },
  {
    // Griya Anak sheet: insentif klinik = (PT + ST + TA) / 60, visit PT/ST/TA + jarak.
    key: 'griya_terapis',
    label: 'Terapis Griya Anak',
    apply: (c) => ({
      ...c, operasional_mode: 'threshold_full', operasional_threshold: 0.75, incentive_target: 60, incentive_full_threshold: 1,
      incentive_activity_codes: ['PAKET_KLINIK', 'SESI_KLINIK', 'TERAPI_AWAL_KLINIK'],
      activity_rates: { PAKET_VISIT: 750000, SESI_VISIT: 125000, TERAPI_AWAL_VISIT: 175000, JARAK_VISIT: 50000, ...c.activity_rates },
    }),
  },
  {
    // Griya Anak sheet: insentif admin = capaian KPI / 100, penuh mulai 75%.
    key: 'griya_admin',
    label: 'Admin Griya Anak',
    apply: (c) => ({
      ...c, operasional_mode: 'threshold_full', operasional_threshold: 0.75, incentive_target: 100, incentive_full_threshold: 0.75,
      incentive_activity_codes: ['KPI_ADMIN'],
    }),
  },
]

interface Props {
  value: Compensation
  onChange: (c: Compensation) => void
  activityTypes: ActivityType[]
  /** false = role earns no Bonus Visit (VISIT_BONUS_ROLES) — the rate section is hidden. */
  visitBonus?: boolean
  /** Griya Anak scope: Griya presets, the "penuh ≥ batas" rules. Hidden on /payroll. */
  griya?: boolean
}

function Money({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <CurrencyInput value={value} onChange={onChange} inputClassName="py-2 rounded-xl" />
      {hint && <p className="text-[10px] text-muted-foreground -mt-0.5">{hint}</p>}
    </div>
  )
}

const GRIYA_PRESETS = new Set(['griya_terapis', 'griya_admin'])

export function CompensationEditor({ value: c, onChange, activityTypes, visitBonus = true, griya = false }: Props) {
  const presets = PRESETS.filter((p) => GRIYA_PRESETS.has(p.key) === griya || p.key === 'staf')
  // Griya-only rules stay visible on /payroll if a version already uses them.
  const showGriyaRules = griya || c.operasional_mode === 'threshold_full' || c.incentive_full_threshold < 1
  const set = (patch: Partial<Compensation>) => onChange({ ...c, ...patch })
  const types = sortActivityTypes(activityTypes).map((t) => ({ ...t, ...activityDisplay(t) }))
  const groups = [...new Set(types.map((t) => t.group))]
  const incentiveIssue = incentiveConfigIssue(c)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">Isi cepat:</span>
        {presets.map((p) => (
          <button key={p.key} type="button" onClick={() => onChange(p.apply(c))}
            className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted">{p.label}</button>
        ))}
      </div>

      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Gaji tetap</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Money label="Gaji pokok" value={c.gaji_pokok} onChange={(gaji_pokok) => set({ gaji_pokok })} />
          <Money label="Tunjangan jabatan" value={c.tj_jabatan} onChange={(tj_jabatan) => set({ tj_jabatan })} />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Tunjangan operasional</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Aturan</label>
            <select className={inputCls} value={c.operasional_mode} onChange={(e) => set({ operasional_mode: e.target.value as Compensation['operasional_mode'] })}>
              <option value="prorata">Prorata kehadiran</option>
              {showGriyaRules && <option value="threshold_full">Penuh jika kehadiran ≥ batas (Griya Anak)</option>}
              <option value="daily_deduction">Potong per hari tidak hadir</option>
              <option value="none">Tidak ada</option>
            </select>
          </div>
          {c.operasional_mode === 'prorata' && (
            <>
              <Money label="Nominal operasional" value={c.operasional} onChange={(operasional) => set({ operasional })} />
              <div>
                <label className={labelCls}>Hangus jika kehadiran ≤ (%)</label>
                <input type="number" min={0} max={100} className={inputCls}
                  value={Math.round(c.operasional_threshold * 100)}
                  onChange={(e) => set({ operasional_threshold: Math.min(100, Math.max(0, Number(e.target.value))) / 100 })} />
              </div>
            </>
          )}
          {c.operasional_mode === 'threshold_full' && (
            <>
              <Money label="Nominal operasional" value={c.operasional} onChange={(operasional) => set({ operasional })} />
              <div>
                <label className={labelCls}>Penuh jika kehadiran ≥ (%)</label>
                <input type="number" min={0} max={100} className={inputCls}
                  value={Math.round(c.operasional_threshold * 100)}
                  onChange={(e) => set({ operasional_threshold: Math.min(100, Math.max(0, Number(e.target.value))) / 100 })} />
              </div>
            </>
          )}
          {c.operasional_mode === 'daily_deduction' && (
            <Money label="Nominal per hari" value={c.operasional_daily_rate} onChange={(operasional_daily_rate) => set({ operasional_daily_rate })}
              hint="(hadir + cuti − hari kerja) × nominal" />
          )}
        </div>
        {c.operasional_mode === 'prorata' && (
          <p className="text-[11px] text-muted-foreground">
            Dihitung: (hadir + tugas + sakit + cuti + alfa) ÷ hari kerja × nominal, dibulatkan ke bawah. Jika rasio ≤ batas, operasional = 0.
          </p>
        )}
        {c.operasional_mode === 'threshold_full' && (
          <p className="text-[11px] text-muted-foreground">
            Kehadiran = (masuk + tugas) ÷ hari kerja. Jika ≥ batas, operasional dibayar penuh; di bawahnya kehadiran × nominal, dibulatkan ke bawah.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Insentif target</h4>
        <div className={`grid grid-cols-1 gap-3 ${showGriyaRules ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <Money label="Insentif penuh" value={c.insentif_base} onChange={(insentif_base) => set({ insentif_base })} />
          <div>
            <label className={labelCls}>Target jumlah (0 = insentif tetap)</label>
            <input type="number" min={0} className={inputCls} value={c.incentive_target}
              onChange={(e) => set({ incentive_target: Math.max(0, Math.round(Number(e.target.value))) })} />
          </div>
          {showGriyaRules && <div>
            <label className={labelCls}>Penuh jika capaian ≥ (%)</label>
            <input type="number" min={1} max={100} className={inputCls}
              value={Math.round(c.incentive_full_threshold * 100)}
              onChange={(e) => set({ incentive_full_threshold: Math.min(100, Math.max(1, Number(e.target.value))) / 100 })} />
          </div>}
        </div>
        <div>
          <label className={labelCls}>Aktivitas yang dihitung ke target</label>
          <div className="flex flex-wrap gap-1.5">
            {types.map((t) => {
              const on = c.incentive_activity_codes.includes(t.code)
              return (
                <button key={t.code} type="button"
                  onClick={() => set({ incentive_activity_codes: on ? c.incentive_activity_codes.filter((x) => x !== t.code) : [...c.incentive_activity_codes, t.code] })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${on ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}>
                  {t.label}
                </button>
              )
            })}
          </div>
          {incentiveIssue && <p className="text-[11px] text-destructive mt-1">{incentiveIssue}</p>}
          <p className="text-[11px] text-muted-foreground mt-1">
            Insentif = min(1, jumlah ÷ target) × insentif penuh, dibulatkan ke bawah
            {c.incentive_full_threshold < 1 ? ` — penuh begitu capaian ≥ ${Math.round(c.incentive_full_threshold * 100)}% target` : ''}.
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={labelCls}>Bonus bertingkat (jika jumlah ≥ batas)</label>
            <button type="button" className="text-xs text-primary inline-flex items-center gap-1"
              onClick={() => set({ bonus_tiers: [...c.bonus_tiers, { min_qty: 0, amount: 0, label: `Bonus Insentif ${c.bonus_tiers.length + 1}` }] })}>
              <Plus size={12} /> Tambah tingkat
            </button>
          </div>
          {c.bonus_tiers.map((t, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_90px_1fr_auto] gap-2 items-start">
              <input className={inputCls} value={t.label ?? ''} placeholder="Label"
                onChange={(e) => set({ bonus_tiers: c.bonus_tiers.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
              <input type="number" min={1} className={inputCls} value={t.min_qty} aria-label="Minimal jumlah"
                onChange={(e) => set({ bonus_tiers: c.bonus_tiers.map((x, j) => j === i ? { ...x, min_qty: Number(e.target.value) } : x) })} />
              <CurrencyInput value={t.amount} inputClassName="py-2 rounded-xl"
                onChange={(amount) => set({ bonus_tiers: c.bonus_tiers.map((x, j) => j === i ? { ...x, amount } : x) })} />
              <button type="button" className="p-2 text-muted-foreground hover:text-destructive" aria-label="Hapus tingkat"
                onClick={() => set({ bonus_tiers: c.bonus_tiers.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </section>

      {visitBonus ? (
        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Tarif per aktivitas (bonus visit)</h4>
          {groups.map((g) => (
            <div key={g}>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">{g}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {types.filter((t) => t.group === g).map((t) => (
                  <div key={t.code}>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">{t.label}</label>
                    <CurrencyInput value={c.activity_rates[t.code] ?? 0} inputClassName="py-1.5 rounded-lg"
                      onChange={(v) => set({ activity_rates: { ...c.activity_rates, [t.code]: v } })} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <p className="text-[11px] text-muted-foreground">Bonus visit hanya untuk Fisioterapis dan Terapis Sport Massage — karyawan ini dibayar lewat insentif target.</p>
      )}
    </div>
  )
}
