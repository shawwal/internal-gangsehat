'use client'

import { PAGE_SIZE_OPTIONS } from './types'

interface Props {
  pageSize: number
  onPageSizeChange: (n: number) => void
  fisioOptions: string[]
  fisio: string
  onFisioChange: (v: string) => void
  layananOptions: string[]
  layanan: string
  onLayananChange: (v: string) => void
  kehadiran: string
  onKehadiranChange: (v: string) => void
}

const selectCls = 'px-2.5 py-1.5 border border-border rounded-xl bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer'

export function JadwalListToolbar({
  pageSize, onPageSizeChange,
  fisioOptions, fisio, onFisioChange,
  layananOptions, layanan, onLayananChange,
  kehadiran, onKehadiranChange,
}: Props) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className={selectCls}
      >
        {PAGE_SIZE_OPTIONS.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <span>data</span>

      <select value={fisio} onChange={(e) => onFisioChange(e.target.value)} className={`${selectCls} ml-2`}>
        <option value="">Semua Fisio</option>
        {fisioOptions.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>

      <select value={layanan} onChange={(e) => onLayananChange(e.target.value)} className={selectCls}>
        <option value="">Semua Layanan</option>
        {layananOptions.map((l) => <option key={l} value={l}>{l}</option>)}
      </select>

      <select value={kehadiran} onChange={(e) => onKehadiranChange(e.target.value)} className={selectCls}>
        <option value="">Semua Kehadiran</option>
        <option value="HADIR">Hadir</option>
        <option value="TIDAK HADIR">Tidak Hadir</option>
        <option value="BELUM">Belum Diisi</option>
      </select>
    </div>
  )
}
