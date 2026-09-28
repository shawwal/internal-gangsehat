'use client'

import type React from 'react'
import { PROGRAM_CHECKED, type RmFieldDef, type RmFieldKey, type RmSectionDef } from './sections'

export const inputCls = 'w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
export const labelCls = 'block text-xs font-medium text-muted-foreground mb-2'

type Form = Record<RmFieldKey, string>
type SetFn = (k: RmFieldKey, v: string) => void

export function Section({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass-card p-5 sm:p-6 space-y-4 ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function ProgramCheckbox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const checked = value.trim() !== '' && value.trim() !== '-'
  const note = value === PROGRAM_CHECKED ? '' : value
  return (
    <div className={`rounded-2xl border p-3.5 transition-colors ${checked ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? PROGRAM_CHECKED : '')}
          className="size-4 accent-primary cursor-pointer shrink-0"
        />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </label>
      {checked && (
        <input
          value={note}
          onChange={(e) => onChange(e.target.value || PROGRAM_CHECKED)}
          placeholder="Catatan (opsional)"
          className={`${inputCls} mt-3`}
        />
      )}
    </div>
  )
}

function Choice({ f, value, onChange }: { f: RmFieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={f.label} className="flex flex-wrap gap-2">
      {f.options!.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? '' : o.value)}
            className={`px-3.5 py-2 rounded-xl border text-sm transition-colors cursor-pointer disabled:cursor-not-allowed ${
              active ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-muted text-foreground'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function FieldInput({ f, value, set }: { f: RmFieldDef; value: string; set: SetFn }) {
  if (f.kind === 'program') return <ProgramCheckbox label={f.label} value={value} onChange={(v) => set(f.k, v)} />
  const wide = f.full || f.kind === 'textarea'
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label className={labelCls}>{f.label}{f.required && ' *'}</label>
      {f.kind === 'choice' ? (
        <Choice f={f} value={value} onChange={(v) => set(f.k, v)} />
      ) : f.kind === 'textarea' ? (
        <textarea value={value} onChange={(e) => set(f.k, e.target.value)} rows={2} className={`${inputCls} resize-y`} />
      ) : (
        <input value={value} onChange={(e) => set(f.k, e.target.value)} className={inputCls} />
      )}
    </div>
  )
}

function renderSection(sec: RmSectionDef, form: Form, set: SetFn, className?: string) {
  return (
    <Section key={sec.title} title={sec.title} subtitle={sec.subtitle} className={className}>
      {sec.fields.map((f) => <FieldInput key={f.k} f={f} value={form[f.k] ?? ''} set={set} />)}
    </Section>
  )
}

/** Renders a form type's sections; consecutive `half` sections pair up side by side on lg screens. */
export function RmSections({ sections, form, set }: { sections: RmSectionDef[]; form: Form; set: SetFn }) {
  const out: React.ReactNode[] = []
  for (let i = 0; i < sections.length; i++) {
    const a = sections[i]
    const b = sections[i + 1]
    if (a.half && b?.half) {
      out.push(
        <div key={a.title + '|' + b.title} className="grid gap-5 lg:grid-cols-2">
          {renderSection(a, form, set, 'h-full')}
          {renderSection(b, form, set, 'h-full')}
        </div>,
      )
      i++
    } else {
      out.push(renderSection(a, form, set))
    }
  }
  return <>{out}</>
}
