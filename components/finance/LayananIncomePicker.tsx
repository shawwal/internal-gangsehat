'use client'

// Kategori + Layanan fields for every form that records income. Both lists come
// from the branch's Tarif Layanan (internal_layanan, /director/layanan), so a
// category or price the branch doesn't sell can't be picked. LAINNYA stays
// free-form; TOKO is written by /toko and only shows when editing a TOKO row.

import { useEffect, useState } from 'react'
import { fetchLayananByBranch, type LayananRow } from '@/app/actions/layanan'
import { branchIncomeKategori, isPriceListExempt } from '@/lib/serviceType'

export interface LayananPick {
  kategori: string
  /** null = no specific price-list item (free-form category, or not chosen yet) */
  layanan: LayananRow | null
}

interface Props {
  branchId: string | null
  kategori: string
  layananId: string | null
  onChange: (pick: LayananPick) => void
  /** Existing row's category — stays selectable even when the price list no longer has it. */
  keepCategory?: string | null
  /** Pick the only item of a kategori automatically (off when editing, so Harga isn't overwritten). */
  autoPick?: boolean
  selectClassName?: string
  labelClassName?: string
}

const DEFAULT_SELECT = 'w-full px-3 py-2 border border-border rounded-xl text-sm bg-input focus:outline-none focus:ring-2 focus:ring-primary'
const DEFAULT_LABEL = 'block text-xs font-medium text-foreground mb-1.5'

export function layananOptionLabel(l: LayananRow) {
  const sesi = l.jumlah_sesi && l.jumlah_sesi > 1 ? ` (${l.jumlah_sesi} sesi)` : ''
  return `${l.nama}${sesi} — Rp ${new Intl.NumberFormat('id-ID').format(Number(l.harga))}`
}

/** True when the form still needs a Layanan before it may be saved. */
export function needsLayananPick(kategori: string, layananId: string | null) {
  return !isPriceListExempt(kategori) && !layananId
}

export function LayananIncomePicker({
  branchId, kategori, layananId, onChange, keepCategory, autoPick = true, selectClassName, labelClassName,
}: Props) {
  // Rows are tagged with their branch so a branch switch reads as "loading" until its own list arrives
  const [loaded, setLoaded] = useState<{ branchId: string; rows: LayananRow[] } | null>(null)
  const rows = branchId && loaded?.branchId === branchId ? loaded.rows : null

  useEffect(() => {
    if (!branchId) return
    let cancelled = false
    fetchLayananByBranch(branchId).then((data) => {
      if (!cancelled) setLoaded({ branchId, rows: data.filter((l) => l.is_active) })
    })
    return () => { cancelled = true }
  }, [branchId])

  const priced = rows ? branchIncomeKategori(rows) : []
  const kategoriOptions = keepCategory && !priced.includes(keepCategory) ? [keepCategory, ...priced] : priced
  const items = (rows ?? []).filter((l) => l.kategori === kategori)
  const selectCls = selectClassName ?? DEFAULT_SELECT
  const labelCls = labelClassName ?? DEFAULT_LABEL

  // Once the list is in: move off a kategori the branch doesn't sell, and pick a
  // kategori's only item.
  useEffect(() => {
    if (!rows) return
    if (!kategoriOptions.includes(kategori)) {
      const first = kategoriOptions[0]
      const only = rows.filter((l) => l.kategori === first)
      onChange({ kategori: first, layanan: autoPick && only.length === 1 ? only[0] : null })
      return
    }
    if (autoPick && !layananId && items.length === 1) onChange({ kategori, layanan: items[0] })
    // onChange deliberately excluded: parents pass inline handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, kategori, layananId, autoPick])

  function handleKategori(next: string) {
    const only = (rows ?? []).filter((l) => l.kategori === next)
    onChange({ kategori: next, layanan: only.length === 1 ? only[0] : null })
  }

  if (!branchId) {
    return (
      <div>
        <label className={labelCls}>Kategori</label>
        <div className={`${selectCls} text-muted-foreground opacity-60`}>Pilih cabang dulu — kategori & tarif mengikuti cabang.</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Kategori</label>
        <select
          value={rows ? kategori : ''}
          onChange={(e) => handleKategori(e.target.value)}
          disabled={!rows}
          className={selectCls}
        >
          {!rows && <option value="">Memuat tarif cabang…</option>}
          {rows && kategoriOptions.map((k) => (
            <option key={k} value={k}>
              {k}{k === keepCategory && !priced.includes(k) ? ' (tidak ada di tarif)' : ''}
            </option>
          ))}
        </select>
        {rows && priced.length === 1 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Cabang ini belum punya Tarif Layanan — tambahkan di menu Tarif Layanan.
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div>
          <label className={labelCls}>
            Layanan {autoPick && <span className="text-destructive">*</span>}
          </label>
          <select
            value={layananId ?? ''}
            onChange={(e) => onChange({ kategori, layanan: items.find((l) => l.id === e.target.value) ?? null })}
            className={selectCls}
          >
            {!items.some((l) => l.id === layananId) && (
              <option value="" disabled={autoPick}>{autoPick ? 'Pilih layanan…' : '— Harga tidak diubah —'}</option>
            )}
            {items.map((l) => <option key={l.id} value={l.id}>{layananOptionLabel(l)}</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">
            {autoPick ? 'Harga mengikuti Tarif Layanan cabang — sesuaikan lewat Diskon.' : 'Pilih layanan untuk mengganti Harga sesuai Tarif Layanan.'}
          </p>
        </div>
      )}
    </div>
  )
}
