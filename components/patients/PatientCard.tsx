'use client'

import Link from 'next/link'
import { Phone, Cake, Droplets, MapPin, Trash2 } from 'lucide-react'
import { getInitials, formatDate, AVATAR_COLORS, GENDER_LABEL } from './types'
import type { PatientPlain } from './types'

interface Props {
  patient:  PatientPlain
  onDelete?: (p: PatientPlain) => void
}

export function PatientCard({ patient: p, onDelete }: Props) {
  return (
    <div className="glass-card hover:border-primary/40 transition-colors group relative">
      <Link href={`/patients/${p.id}`} className="block p-4">
        {/* Top row: avatar + name + badges */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${
            AVATAR_COLORS[p.gender ?? 'other']
          }`}>
            {getInitials(p.name)}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {p.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {GENDER_LABEL[p.gender ?? 'other'] ?? 'Lainnya'}
            </p>
          </div>

          {/* No. RM + Blood type badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {p.no_rm && (
              <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded-md leading-relaxed">
                {p.no_rm}
              </span>
            )}
            {p.blood_type && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive">
                <Droplets size={9} />{p.blood_type}
              </span>
            )}
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-1.5">
          {p.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone size={11} className="shrink-0" />
              <span className="truncate">{p.phone}</span>
            </div>
          )}
          {p.birthDate && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Cake size={11} className="shrink-0" />
              <span>{formatDate(p.birthDate)}</span>
            </div>
          )}
          {p.kabupaten_kota && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">{p.kabupaten_kota}</span>
            </div>
          )}
        </div>
      </Link>

      {onDelete && (
        <button
          onClick={() => onDelete(p)}
          className="absolute bottom-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive cursor-pointer"
          title="Hapus pasien"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}
