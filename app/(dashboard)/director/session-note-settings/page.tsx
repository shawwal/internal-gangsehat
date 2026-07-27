'use client'

import { useEffect, useState } from 'react'
import { Loader2, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

type FormMode = 'single_step' | 'multi_step'

export default function SessionNoteSettingsPage() {
  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    createClient()
      .from('session_note_settings')
      .select('form_mode')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setFormMode((data?.form_mode as FormMode) ?? 'single_step')
        setLoading(false)
      })
  }, [])

  async function toggle() {
    if (!formMode || saving) return
    const prev = formMode
    const next: FormMode = prev === 'single_step' ? 'multi_step' : 'single_step'
    setFormMode(next)
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase
      .from('session_note_settings')
      .update({ form_mode: next, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('id', 1)

    setSaving(false)
    if (err) {
      setFormMode(prev)
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Form Catatan Perawatan</h1>
        <p className="text-sm text-muted-foreground">
          Atur tampilan form Catatan Perawatan (SOAP) yang digunakan oleh seluruh staff
        </p>
      </div>

      <div className="glass-card p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
            <Loader2 size={15} className="animate-spin" /> Memuat...
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Form Multi-Langkah</p>
                <p className="text-xs text-muted-foreground">
                  {formMode === 'multi_step'
                    ? 'Aktif — form ditampilkan satu bagian (Subjective/Objective/Assessment/Plan) per langkah'
                    : 'Nonaktif — seluruh bagian SOAP ditampilkan dalam satu halaman'}
                </p>
              </div>
            </div>
            {saving ? (
              <span className="w-9 h-5 flex items-center justify-center shrink-0">
                <Loader2 size={13} className="animate-spin text-muted-foreground" />
              </span>
            ) : (
              <ToggleSwitch
                checked={formMode === 'multi_step'}
                onClick={toggle}
                label={formMode === 'multi_step' ? 'Gunakan form satu halaman' : 'Gunakan form multi-langkah'}
              />
            )}
          </div>
        )}
        {error && <p className="text-xs text-destructive mt-3">{error}</p>}
      </div>
    </div>
  )
}
