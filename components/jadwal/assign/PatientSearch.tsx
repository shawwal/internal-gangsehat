'use client'

import { RefObject } from 'react'
import { Search, UserPlus } from 'lucide-react'
import type { PatientPlain } from '@/app/actions/patients'

interface Props {
  search: string
  setSearch: (v: string) => void
  results: PatientPlain[]
  searching: boolean
  searchRef: RefObject<HTMLInputElement | null>
  onSelect: (p: PatientPlain) => void
}

function avatarClass(gender: PatientPlain['gender']) {
  if (gender === 'male')   return 'bg-blue-500/20 text-blue-400'
  if (gender === 'female') return 'bg-primary/20 text-primary'
  return 'bg-muted text-muted-foreground'
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export function PatientSearch({ search, setSearch, results, searching, searchRef, onSelect }: Props) {
  const hasQuery = search.trim().length >= 2

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Pilih Pasien</p>
        <button
          onClick={() => window.open('/patients/new?source=jadwal', '_blank')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary text-xs font-medium transition-all duration-200 cursor-pointer shrink-0"
        >
          <UserPlus size={12} />
          Pasien Baru
        </button>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama atau nomor telepon..."
          className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
        />
      </div>

      {/* Results */}
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {!hasQuery ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Ketik minimal 2 huruf untuk mencari pasien.{' '}
            <span className="text-xs">Pasien baru? Klik &quot;Pasien Baru&quot; di atas, lalu cari namanya di sini.</span>
          </p>
        ) : searching ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-xl bg-white/5" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Pasien tidak ditemukan
          </p>
        ) : (
          results.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-left border border-transparent hover:border-primary/30"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(p.gender)}`}>
                {initials(p.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
