'use client'

import { useEffect, useState } from 'react'
import { Loader2, FileText, ClipboardList } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

type FormMode = 'single_step' | 'multi_step'

interface Settings {
  form_mode: FormMode
  assessment_form_mode: FormMode
}

const FIELD_META = {
  form_mode: {
    title: 'Form Catatan Perawatan (SOAP)',
    icon: FileText,
    activeDesc: 'Aktif — form ditampilkan satu bagian (Subjective/Objective/Assessment/Plan) per langkah',
    inactiveDesc: 'Nonaktif — seluruh bagian SOAP ditampilkan dalam satu halaman',
  },
  assessment_form_mode: {
    title: 'Form Guided MSK & Sports Assessment',
    icon: ClipboardList,
    activeDesc: 'Aktif — form ditampilkan satu bagian (Interview/Physical Examination/dst.) per langkah',
    inactiveDesc: 'Nonaktif — seluruh bagian asesmen ditampilkan dalam satu halaman',
  },
} as const

export default function SessionNoteSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading]   = useState(true)
  const [savingField, setSavingField] = useState<keyof Settings | null>(null)
  const [error, setError]       = useState('')

  useEffect(() => {
    createClient()
      .from('session_note_settings')
      .select('form_mode, assessment_form_mode')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        setSettings({
          form_mode: (data?.form_mode as FormMode) ?? 'single_step',
          assessment_form_mode: (data?.assessment_form_mode as FormMode) ?? 'single_step',
        })
        setLoading(false)
      })
  }, [])

  async function toggle(field: keyof Settings) {
    if (!settings || savingField) return
    const prev = settings
    const next: FormMode = prev[field] === 'single_step' ? 'multi_step' : 'single_step'
    setSettings({ ...prev, [field]: next })
    setSavingField(field)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase
      .from('session_note_settings')
      .update({ [field]: next, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('id', 1)

    setSavingField(null)
    if (err) {
      setSettings(prev)
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Form Klinis</h1>
        <p className="text-sm text-muted-foreground">
          Atur tampilan form klinis (SOAP & Asesmen) yang digunakan oleh seluruh staff
        </p>
      </div>

      <div className="glass-card p-5">
        {loading || !settings ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
            <Loader2 size={15} className="animate-spin" /> Memuat...
          </div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(FIELD_META) as (keyof Settings)[]).map((field, i) => {
              const meta = FIELD_META[field]
              const Icon = meta.icon
              const isMulti = settings[field] === 'multi_step'
              return (
                <div
                  key={field}
                  className={`flex items-center justify-between gap-4 ${i > 0 ? 'pt-4 border-t border-border/40' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{meta.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {isMulti ? meta.activeDesc : meta.inactiveDesc}
                      </p>
                    </div>
                  </div>
                  {savingField === field ? (
                    <span className="w-9 h-5 flex items-center justify-center shrink-0">
                      <Loader2 size={13} className="animate-spin text-muted-foreground" />
                    </span>
                  ) : (
                    <ToggleSwitch
                      checked={isMulti}
                      onClick={() => toggle(field)}
                      label={isMulti ? 'Gunakan form satu halaman' : 'Gunakan form multi-langkah'}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
        {error && <p className="text-xs text-destructive mt-3">{error}</p>}
      </div>
    </div>
  )
}
