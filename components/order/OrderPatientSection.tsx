'use client'

import { useEffect, useRef, useState } from 'react'
import { UserRound, X } from 'lucide-react'
import { searchPatients, type PatientPlain } from '@/app/actions/patients'
import { PatientSearch } from '@/components/jadwal/assign/PatientSearch'

interface Props {
  patient: PatientPlain | null
  error?: string
  onSelect: (patient: PatientPlain | null) => void
}

function avatarClass(gender: PatientPlain['gender']) {
  if (gender === 'male') return 'bg-blue-500/20 text-blue-400'
  if (gender === 'female') return 'bg-primary/20 text-primary'
  return 'bg-muted text-muted-foreground'
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export function OrderPatientSection({ patient, error, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<PatientPlain[]>([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const q = search.trim()
    const t = setTimeout(() => {
      if (q.length < 2) { setResults([]); setSearching(false); return }
      setSearching(true)
      searchPatients(q).then((r) => { setResults(r); setSearching(false) })
    }, q.length < 2 ? 0 : 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className="glass-card p-4 sm:p-5 space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <UserRound size={14} className="text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Pasien</h2>
        <span className="text-destructive text-sm">*</span>
      </div>

      {patient ? (
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-primary/30 bg-primary/5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${avatarClass(patient.gender)}`}>
            {initials(patient.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{patient.name}</p>
            {patient.phone && <p className="text-xs text-muted-foreground">{patient.phone}</p>}
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null); setSearch(''); setResults([]) }}
            className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors shrink-0 cursor-pointer"
            aria-label="Ganti pasien"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <PatientSearch
          search={search}
          setSearch={setSearch}
          results={results}
          searching={searching}
          searchRef={searchRef}
          onSelect={(p) => { onSelect(p); setSearch('') }}
        />
      )}

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  )
}
