'use client'

import { Sparkles } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { DISCOUNT_PRESETS, PAYMENT_METHODS, inputCls, labelCls } from './constants'
import type { CreateOrderForm, CreateOrderFormErrors, LayananOption } from './types'

interface Props {
  form: CreateOrderForm
  errors: CreateOrderFormErrors
  layananOptions: LayananOption[]
  loadingLayanan: boolean
  discountAmount: number
  totalAfterDiscount: number
  hargaNum: number
  dpNum: number
  field: <K extends keyof CreateOrderForm>(key: K, value: CreateOrderForm[K]) => void
  selectLayanan: (id: string) => void
}

export function OrderServiceSection({
  form, errors, layananOptions, loadingLayanan,
  discountAmount, totalAfterDiscount, hargaNum, dpNum,
  field, selectLayanan,
}: Props) {
  return (
    <div className="glass-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles size={14} className="text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Detail Layanan</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Layanan */}
        <div>
          <label className={labelCls}>Layanan <span className="text-destructive">*</span></label>
          <select
            value={form.layananId}
            onChange={(e) => selectLayanan(e.target.value)}
            disabled={loadingLayanan || layananOptions.length === 0}
            className={`${inputCls} cursor-pointer disabled:opacity-50`}
          >
            <option value="" disabled>
              {loadingLayanan ? 'Memuat layanan…' : layananOptions.length === 0 ? 'Tidak ada layanan aktif' : '— Pilih layanan —'}
            </option>
            {layananOptions.map((l) => (
              <option key={l.id} value={l.id}>{l.nama}</option>
            ))}
          </select>
          {errors.layanan && <p className="text-xs text-destructive mt-1">{errors.layanan}</p>}
        </div>

        {/* Harga */}
        <div>
          <label className={labelCls}>Harga <span className="text-destructive">*</span></label>
          <input
            type="number"
            min={0}
            value={form.harga}
            onChange={(e) => field('harga', e.target.value)}
            placeholder="0"
            className={inputCls}
          />
          {errors.harga && <p className="text-xs text-destructive mt-1">{errors.harga}</p>}
        </div>

        {/* Potongan Harga */}
        <div>
          <label className={labelCls}>Potongan Harga</label>
          <select
            value={form.discountPresetLabel}
            onChange={(e) => field('discountPresetLabel', e.target.value)}
            className={`${inputCls} cursor-pointer`}
          >
            {DISCOUNT_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>{p.label}</option>
            ))}
          </select>
          {form.discountPresetLabel === 'Custom' && (
            <input
              type="number"
              min={0}
              max={100}
              value={form.customDiscountPct}
              onChange={(e) => field('customDiscountPct', e.target.value)}
              placeholder="Persentase diskon (%)"
              className={`${inputCls} mt-2`}
            />
          )}
          {errors.discount && <p className="text-xs text-destructive mt-1">{errors.discount}</p>}
        </div>

        {/* DP / Pelunasan */}
        <div>
          <label className={labelCls}>DP / Pelunasan</label>
          <input
            type="number"
            min={0}
            value={form.dpAmount}
            onChange={(e) => field('dpAmount', e.target.value)}
            placeholder="0"
            className={inputCls}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Maksimal bayar saat ini: <span className="font-medium text-foreground">{formatCurrency(totalAfterDiscount)}</span>
          </p>
          {errors.dp && <p className="text-xs text-destructive mt-1">{errors.dp}</p>}
        </div>

        {/* Metode pembayaran — only relevant once a DP is entered */}
        {dpNum > 0 && (
          <div>
            <label className={labelCls}>Metode Pembayaran</label>
            <select
              value={form.dpMetode}
              onChange={(e) => field('dpMetode', e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              <option value="">— Pilih metode —</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Computed summary */}
      {hargaNum > 0 && (
        <div className="rounded-2xl bg-muted/30 border border-border/60 p-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Harga</span>
            <span className="text-foreground font-medium tabular-nums">{formatCurrency(hargaNum)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Diskon</span>
              <span className="text-chart-4 font-medium tabular-nums">− {formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-border/60">
            <span className="text-foreground font-semibold">Total</span>
            <span className="text-foreground font-bold tabular-nums">{formatCurrency(totalAfterDiscount)}</span>
          </div>
          {dpNum > 0 && (
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-muted-foreground">Sisa setelah DP</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatCurrency(Math.max(0, totalAfterDiscount - dpNum))}
              </span>
            </div>
          )}
        </div>
      )}

      <div>
        <label className={labelCls}>Catatan Admin <span className="text-muted-foreground font-normal">(opsional)</span></label>
        <textarea
          value={form.adminNotes}
          onChange={(e) => field('adminNotes', e.target.value)}
          rows={2}
          placeholder="Catatan tambahan untuk order ini…"
          className={`${inputCls} resize-none`}
        />
      </div>
    </div>
  )
}
