'use client'

import Link from 'next/link'
import { ChevronRight, Phone, Droplets, MapPin } from 'lucide-react'
import { getInitials, formatDate, AVATAR_COLORS, GENDER_LABEL } from './types'
import type { PatientPlain } from './types'

interface Props {
  patients: PatientPlain[]
}

export function PatientTable({ patients }: Props) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Daftar pasien">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 w-8 tabular-nums">
                #
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                Pasien
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                No. RM
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                Telepon
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                Gender
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                Gol. Darah
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                Kota
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">
                Pekerjaan
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden xl:table-cell">
                Tgl. Daftar
              </th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {patients.map((p, i) => (
              <tr
                key={p.id}
                className={`hover:bg-muted/40 transition-colors group ${
                  i !== patients.length - 1 ? 'border-b border-border/40' : ''
                }`}
              >
                {/* Row number */}
                <td className="px-4 py-3 text-xs text-muted-foreground/50 font-mono tabular-nums">
                  {i + 1}
                </td>

                {/* Avatar + Name */}
                <td className="px-4 py-3">
                  <Link href={`/patients/${p.id}`} className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                      AVATAR_COLORS[p.gender ?? 'other']
                    }`}>
                      {getInitials(p.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground group-hover:text-primary transition-colors truncate max-w-[150px]">
                        {p.name}
                      </p>
                      {p.birthDate && (
                        <p className="text-xs text-muted-foreground">{formatDate(p.birthDate)}</p>
                      )}
                    </div>
                  </Link>
                </td>

                {/* No. RM */}
                <td className="px-4 py-3 hidden sm:table-cell">
                  {p.no_rm
                    ? <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded-md text-muted-foreground">{p.no_rm}</span>
                    : <span className="text-muted-foreground/40 text-xs">—</span>
                  }
                </td>

                {/* Phone */}
                <td className="px-4 py-3 hidden md:table-cell">
                  {p.phone
                    ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone size={11} className="shrink-0" />{p.phone}
                      </span>
                    : <span className="text-muted-foreground/40 text-xs">—</span>
                  }
                </td>

                {/* Gender */}
                <td className="px-4 py-3 hidden md:table-cell">
                  {p.gender
                    ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.gender === 'male'   ? 'bg-blue-500/10 text-blue-600' :
                        p.gender === 'female' ? 'bg-primary/10 text-primary' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {GENDER_LABEL[p.gender]}
                      </span>
                    : <span className="text-muted-foreground/40 text-xs">—</span>
                  }
                </td>

                {/* Blood type */}
                <td className="px-4 py-3 hidden lg:table-cell">
                  {p.blood_type
                    ? <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-destructive/10 text-destructive w-fit">
                        <Droplets size={10} />{p.blood_type}
                      </span>
                    : <span className="text-muted-foreground/40 text-xs">—</span>
                  }
                </td>

                {/* City */}
                <td className="px-4 py-3 hidden lg:table-cell">
                  {p.kabupaten_kota
                    ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate max-w-[100px]">{p.kabupaten_kota}</span>
                      </span>
                    : <span className="text-muted-foreground/40 text-xs">—</span>
                  }
                </td>

                {/* Pekerjaan */}
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-xs text-muted-foreground truncate max-w-[100px] block">
                    {p.pekerjaan ?? <span className="text-muted-foreground/40">—</span>}
                  </span>
                </td>

                {/* Tgl Daftar */}
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(p.createdAt)}
                  </span>
                </td>

                {/* Chevron */}
                <td className="px-4 py-3">
                  <Link
                    href={`/patients/${p.id}`}
                    className="flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors cursor-pointer"
                    aria-label={`Lihat detail ${p.name}`}
                  >
                    <ChevronRight size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
