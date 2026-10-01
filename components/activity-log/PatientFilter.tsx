'use client'

import { useEffect, useRef, useState } from 'react'
import { User, X } from 'lucide-react'
import { searchPatientsForActivityLog } from '@/app/actions/patients'

type PatientResult = Awaited<ReturnType<typeof searchPatientsForActivityLog>>[number]

export function PatientFilter({
  patient,
  onChange,
}: {
  patient: { id: string; name: string } | null
  onChange: (patientId: string | undefined) => void
}) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<PatientResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hasQuery = term.trim().length >= 2

  useEffect(() => {
    if (!hasQuery) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      const found = await searchPatientsForActivityLog(term)
      if (cancelled) return
      setResults(found)
      setSearching(false)
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [term, hasQuery])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (patient) {
    return (
      <div className="flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-xl bg-primary/10 border border-primary/30 text-sm text-primary">
        <User size={14} />
        <span className="font-medium max-w-[180px] truncate">{patient.name}</span>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          aria-label="Hapus filter pasien"
          className="p-0.5 rounded-md hover:bg-primary/20 transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative flex items-center">
      <User size={14} className="absolute left-3 text-muted-foreground pointer-events-none" />
      <input
        value={term}
        onChange={(e) => { setTerm(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        placeholder="Cari pasien…"
        className="pl-8 pr-3 py-2 text-sm rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary w-56 transition-all"
      />

      {open && hasQuery && (
        <div className="absolute left-0 top-full mt-1.5 z-20 w-72 max-h-64 overflow-y-auto rounded-xl border border-border bg-card shadow-2xl p-1">
          {searching ? (
            <p className="text-xs text-muted-foreground text-center py-4">Mencari…</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Pasien tidak ditemukan</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setOpen(false); setTerm(''); onChange(p.id) }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.no_rm ?? 'Tanpa No. RM'}</p>
                </div>
                {!p.is_active && (
                  <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">
                    Nonaktif
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
