import React from 'react'
import { formatRpCompact } from './utils'

interface TooltipPayload {
  value: number
  name: string
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  currency?: boolean
}

export function CustomTooltip({ active, payload, label, currency }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      backgroundColor: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    }}>
      <p style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {currency ? formatRpCompact(p.value) : p.value.toLocaleString('id-ID')}
        </p>
      ))}
    </div>
  )
}
