'use client'

import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { fetchReminderTemplate, saveReminderTemplate } from '@/app/actions/reminder-template'
import { fillTemplate, DEFAULT_REMINDER_TEMPLATE } from '@/lib/utils'

const PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'nama',    label: 'Nama pasien' },
  { key: 'tanggal', label: 'Tanggal kunjungan' },
  { key: 'jam',     label: 'Jam kunjungan' },
  { key: 'layanan', label: 'Jenis layanan' },
  { key: 'cabang',  label: 'Nama cabang' },
  { key: 'terapis', label: 'Nama terapis' },
]

const SAMPLE_VARS = {
  nama:    'Budi Santoso',
  tanggal: '15 Jul 2026',
  jam:     '09:00',
  layanan: 'SESI TERAPI',
  cabang:  'Fisioterapi Gang Sehat Pontianak',
  terapis: 'Suci',
}

export default function ReminderTemplatePage() {
  const [template, setTemplate] = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetchReminderTemplate().then((t) => {
      setTemplate(t)
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    const { error } = await saveReminderTemplate(template)
    setSaving(false)
    if (error) { setError(error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Template Pesan WA</h1>
        <p className="text-sm text-muted-foreground">
          Atur pesan pengingat WhatsApp yang dikirim ke pasien untuk sesi terjadwal
        </p>
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      ) : (
        <>
          {/* Editor */}
          <div className="glass-card p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5">Isi Pesan</label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
            </div>

            <div>
              <p className="text-xs font-medium mb-1.5">Placeholder yang tersedia</p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
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
                onClick={handleSave}
                disabled={saving || !template.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
                {saving ? 'Menyimpan...' : saved ? 'Tersimpan' : 'Simpan'}
              </button>
              <button
                onClick={() => setTemplate(DEFAULT_REMINDER_TEMPLATE)}
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
              {fillTemplate(template, SAMPLE_VARS)}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
