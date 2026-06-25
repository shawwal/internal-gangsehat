'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowRightLeft, ChevronDown, Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { reclassifyAsExpense } from '@/app/actions/transactions'

const EXPENSE_CATEGORIES = [
  'BEBAN PELAYANAN',
  'GAJI',
  'SEWA',
  'LISTRIK',
  'MARKETING',
  'TUKAR TUNAI',
  'LAINNYA',
]

export function ReclassifyButton({ transactionId }: { transactionId: string }) {
  const router = useRouter()
  const [open, setOpen]     = useState(false)
  const [cat, setCat]       = useState(EXPENSE_CATEGORIES[0])
  const [saving, setSaving] = useState(false)
  const [done, setDone]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  async function handleConfirm() {
    setSaving(true)
    const { error } = await reclassifyAsExpense(transactionId, cat)
    setSaving(false)
    if (!error) {
      setDone(true)
      setTimeout(() => { setOpen(false); router.refresh() }, 600)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Ubah ke Pengeluaran"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap"
      >
        <ArrowRightLeft size={10} />
        Pengeluaran
        <ChevronDown size={9} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-xl border border-white/15 bg-gray-900/95 backdrop-blur-xl shadow-2xl p-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-2 py-1.5 font-semibold">
            Kategori Pengeluaran
          </p>
          <div className="space-y-0.5 mb-2">
            {EXPENSE_CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  cat === c
                    ? 'bg-destructive/15 text-destructive font-semibold'
                    : 'text-foreground/70 hover:bg-white/8 hover:text-foreground'
                }`}
              >
                {c}
                {cat === c && <Check size={10} />}
              </button>
            ))}
          </div>
          <button
            onClick={handleConfirm}
            disabled={saving || done}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              done
                ? 'bg-[#34C759]/20 text-[#34C759] border border-[#34C759]/30'
                : 'bg-destructive text-white hover:bg-destructive/90 disabled:opacity-60'
            }`}
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            {done && <Check size={11} />}
            {done ? 'Berhasil!' : saving ? 'Menyimpan…' : 'Konfirmasi'}
          </button>
        </div>
      )}
    </div>
  )
}
