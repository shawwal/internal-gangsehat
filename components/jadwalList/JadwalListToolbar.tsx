'use client'

import { NO_TARIF, PAGE_SIZE_OPTIONS, type JadwalTarifOption } from './types'

interface Props {
  pageSize: number
  onPageSizeChange: (n: number) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (iso: string) => void
  onDateToChange: (iso: string) => void
  fisioOptions: string[]
  fisio: string
  onFisioChange: (v: string) => void
  tarifOptions: JadwalTarifOption[]
  tarif: string
  onTarifChange: (v: string) => void
  kehadiran: string
  onKehadiranChange: (v: string) => void
}

const selectCls = 'px-2.5 py-1.5 border border-border rounded-xl bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer'

export function JadwalListToolbar({
  pageSize, onPageSizeChange,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  fisioOptions, fisio, onFisioChange,
  tarifOptions, tarif, onTarifChange,
  kehadiran, onKehadiranChange,
}: Props) {
  // Tarif Layanan grouped by kategori, like the price-list page
  const groups = new Map<string, JadwalTarifOption[]>()
  for (const t of tarifOptions) groups.set(t.kategori, [...(groups.get(t.kategori) ?? []), t])

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

      <div className="flex items-center gap-1.5 ml-2">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => e.target.value && onDateFromChange(e.target.value)}
          aria-label="Dari tanggal"
          className={selectCls}
        />
        <span>–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => e.target.value && onDateToChange(e.target.value)}
          aria-label="Sampai tanggal"
          className={selectCls}
        />
      </div>

      <select value={fisio} onChange={(e) => onFisioChange(e.target.value)} className={selectCls}>
        <option value="">Semua Fisio</option>
        {fisioOptions.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>

      <select value={tarif} onChange={(e) => onTarifChange(e.target.value)} className={selectCls}>
        <option value="">Semua Layanan</option>
        {[...groups].map(([kategori, items]) => (
          <optgroup key={kategori} label={kategori}>
            {items.map((t) => (
              <option key={t.id} value={t.id}>{t.nama}{t.is_active ? '' : ' (nonaktif)'}</option>
            ))}
          </optgroup>
        ))}
        <option value={NO_TARIF}>Tanpa tarif layanan</option>
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
