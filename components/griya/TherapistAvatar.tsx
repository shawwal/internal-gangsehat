'use client'

import { useState } from 'react'
import type { Discipline } from '@/app/actions/griyaJadwal'
import { DISCIPLINE_COLOR } from './constants'

interface Props {
  name: string
  url: string | null
  discipline: Discipline
  size?: number
}

export function TherapistAvatar({ name, url, discipline, size = 28 }: Props) {
  const [imgError, setImgError] = useState(false)
  const showImg = !!url && !imgError
  const initials = name.split(' ').map((n) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
  const dc = DISCIPLINE_COLOR[discipline]

  return (
    <div
      className={`rounded-full overflow-hidden shrink-0 border-2 ${dc?.bar ?? 'border-border'}`}
      style={{ width: size, height: size }}
    >
      {showImg ? (
        <img src={url!} alt={name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
      ) : (
        <div className={`w-full h-full flex items-center justify-center font-bold text-white ${dc?.dot ?? 'bg-muted'}`} style={{ fontSize: size * 0.38 }}>
          {initials}
        </div>
      )}
    </div>
  )
}
