'use client'

import { Check, Loader2 } from 'lucide-react'
import { fillTemplate } from '@/lib/utils'

interface Props {
  title: string
  description: string
  template: string
  onChange: (value: string) => void
  onSave: () => void
  onReset: () => void
  saving: boolean
  saved: boolean
  error: string | null
  placeholders: { key: string; label: string }[]
  sampleVars: Record<string, string>
}

export function TemplateEditorCard({
  title, description, template, onChange, onSave, onReset,
  saving, saved, error, placeholders, sampleVars,
}: Props) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="glass-card p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5">Isi Pesan</label>
          <textarea
            value={template}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          />
        </div>

        <div>
          <p className="text-xs font-medium mb-1.5">Placeholder yang tersedia</p>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((p) => (
              <span
                key={p.key}
                title={p.label}
                className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-primary/10 text-primary"
              >
                {`{{${p.key}}}`}
              </span>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={saving || !template.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saving ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan'}
          </button>
          <button
            onClick={onReset}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Kembalikan ke default
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="glass-card p-5 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Pratinjau</p>
        <p className="text-sm whitespace-pre-wrap bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl px-3 py-2.5 text-foreground">
          {fillTemplate(template, sampleVars)}
        </p>
      </div>
    </div>
  )
}
