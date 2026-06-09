'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChartCard } from './ChartCard'
import { PIE_COLORS } from './utils'

interface ServiceDonutChartProps {
  ta: number
  paket: number
  sesi: number
}

export function ServiceDonutChart({ ta, paket, sesi }: ServiceDonutChartProps) {
  const total = ta + paket + sesi
  const data = [
    { name: 'TA Klinik',   value: ta    },
    { name: 'Sesi Klinik', value: sesi  },
    { name: 'Paket Klinik', value: paket },
  ].filter(d => d.value > 0)

  if (!total) {
    return (
      <ChartCard title="Breakdown Layanan" subtitle="Proporsi jenis layanan">
        <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
          Belum ada data
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Breakdown Layanan" subtitle="Proporsi jenis layanan tahun ini">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={88}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((_, idx) => (
              <Cell
                key={idx}
                fill={PIE_COLORS[idx % PIE_COLORS.length]}
                stroke="none"
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [
              `${Number(v).toLocaleString('id-ID')} (${total ? ((Number(v) / total) * 100).toFixed(1) : 0}%)`,
              '',
            ]}
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
