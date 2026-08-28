'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchSales, fetchSaleItems, voidSale, deleteSale, type SaleRow, type SaleItemRow } from '@/app/actions/griyaToko'
import { Pagination } from '@/components/leave/Pagination'
import { useToast } from '@/context/ToastContext'

const PAGE_SIZE = 10
function rp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function monthRange(d: Date) {
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const nm = d.getMonth() === 11 ? 1 : d.getMonth() + 2
  const ny = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear()
  return { from, toExclusive: `${ny}-${String(nm).padStart(2, '0')}-01` }
}

export function RiwayatTab({ branchId }: { branchId: string }) {
  const { showToast } = useToast()
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })
  const [rows, setRows] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [items, setItems] = useState<SaleItemRow[]>([])

  const reload = useCallback(() => {
    setLoading(true)
    const [y, m] = month.split('-').map(Number)
    fetchSales(branchId, monthRange(new Date(y, m - 1, 1))).then((r) => { setRows(r); setLoading(false) })
  }, [branchId, month])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { setPage(1) }, [month])

  useEffect(() => {
    if (!openId) { setItems([]); return }
    fetchSaleItems(openId).then(setItems)
  }, [openId])

  const total = rows.reduce((s, r) => s + (r.status === 'void' ? 0 : r.total), 0)
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2 border border-border rounded-xl text-sm bg-input" />
        <span className="text-sm text-muted-foreground">Total bulan ini: <b className="text-foreground">{rp(total)}</b></span>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tanggal</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Metode</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Memuat...</td></tr>
            ) : paged.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Belum ada penjualan.</td></tr>
            ) : paged.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{new Date(s.sale_date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">{s.payment_method ?? '—'}</td>
                <td className="px-4 py-2 text-right">{rp(s.total)}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'void' ? 'bg-destructive/15 text-destructive' : 'bg-[#34C759]/15 text-[#34C759]'}`}>
                    {s.status === 'void' ? 'Dibatalkan' : 'Selesai'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setOpenId(openId === s.id ? null : s.id)} className="text-xs text-primary cursor-pointer">Detail</button>
                  {s.status !== 'void' && (
                    <button
                      onClick={async () => { if (confirm('Batalkan penjualan ini? Stok akan dikembalikan, catatan tetap ada.')) { const { error } = await voidSale(s.id); if (error) showToast(error, 'error'); else { showToast('Dibatalkan', 'success'); reload() } } }}
                      className="text-xs text-[#FFB35C] ml-3 cursor-pointer">Batalkan</button>
                  )}
                  <button
                    onClick={async () => { if (confirm('Hapus permanen dari riwayat? Stok dikembalikan & pemasukan dihapus.')) { const { error } = await deleteSale(s.id); if (error) showToast(error, 'error'); else { showToast('Dihapus', 'success'); reload() } } }}
                    className="text-xs text-destructive ml-3 cursor-pointer">Hapus</button>
                </td>
              </tr>
            ))}
            {openId && items.length > 0 && (
              <tr><td colSpan={5} className="px-4 py-2 bg-muted/30">
                <div className="space-y-1">
                  {items.map((it) => (
                    <div key={it.id} className="flex justify-between text-xs">
                      <span>{it.product_name} ×{it.qty}</span>
                      <span>{rp(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
    </div>
  )
}
