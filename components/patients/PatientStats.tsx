'use client'

import { HeartPulse, User, Users } from 'lucide-react'
import type { PatientPlain } from './types'

interface Props {
  patients: PatientPlain[]
  loading:  boolean
}

export function PatientStats({ patients, loading }: Props) {
  const maleCount   = patients.filter(p => p.gender === 'male').length
  const femaleCount = patients.filter(p => p.gender === 'female').length
  const otherCount  = patients.filter(p => p.gender === 'other').length

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse bg-muted rounded-3xl h-20" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Users size={17} className="text-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground leading-none">{patients.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Pasien</p>
        </div>
      </div>

      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
          <User size={17} className="text-blue-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground leading-none">{maleCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Laki-laki</p>
        </div>
      </div>

      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <User size={17} className="text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground leading-none">{femaleCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Perempuan</p>
        </div>
      </div>

      <div className="glass-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
          <HeartPulse size={17} className="text-secondary-foreground" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground leading-none">{otherCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Lainnya</p>
        </div>
      </div>
    </div>
  )
}
