import Link from 'next/link'
import { Clock, UserX, X } from 'lucide-react'
import { Suspense } from 'react'
import { SearchInput } from './SearchInput'
import {
  buildFinanceUrl, TX_STATUS_VALUES, TX_STATUS_LABEL, PAY_STATUS_VALUES,
} from './types'

interface Props {
  baseParams: Record<string, string>
  q: string
  txnTotal: number
  txType: 'income' | 'expense' | ''
  noPatient: boolean
  status: string
  payStatus: string
}

const PILL_ACTIVE = 'bg-primary text-primary-foreground shadow'
const PILL_INACTIVE = 'text-muted-foreground hover:text-foreground'

export function TransactionsToolbar({ baseParams, q, txnTotal, txType, noPatient, status, payStatus }: Props) {
  const hasActiveFilters = !!(q || txType || noPatient || status || payStatus)

  return (
    <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Transaksi</h2>
          <span className="text-xs text-muted-foreground">
            {txnTotal}{q ? ` untuk "${q}"` : ''}
          </span>
        </div>

        {/* Income / Expense type filter */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10">
          <Link
            href={buildFinanceUrl(baseParams, { tx_type: txType === 'income' ? undefined : 'income', page: undefined })}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
              txType === 'income' ? 'bg-[#34C759] text-white shadow' : PILL_INACTIVE
            }`}
          >
            Pemasukan
          </Link>
          <Link
            href={buildFinanceUrl(baseParams, { tx_type: txType === 'expense' ? undefined : 'expense', page: undefined })}
            className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${
              txType === 'expense' ? 'bg-destructive text-white shadow' : PILL_INACTIVE
            }`}
          >
            Pengeluaran
          </Link>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10">
          <Link
            href={buildFinanceUrl(baseParams, { status: undefined, page: undefined })}
            className={`px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${status === '' ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            Semua
          </Link>
          {TX_STATUS_VALUES.map(s => (
            <Link
              key={s}
              href={buildFinanceUrl(baseParams, { status: status === s ? undefined : s, page: undefined })}
              className={`px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${status === s ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              {TX_STATUS_LABEL[s]}
            </Link>
          ))}
        </div>

        {/* Payment status filter */}
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/5 border border-white/10">
          <Link
            href={buildFinanceUrl(baseParams, { pay_status: undefined, page: undefined })}
            className={`px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${payStatus === '' ? PILL_ACTIVE : PILL_INACTIVE}`}
          >
            Semua Bayar
          </Link>
          {PAY_STATUS_VALUES.map(s => (
            <Link
              key={s}
              href={buildFinanceUrl(baseParams, { pay_status: payStatus === s ? undefined : s, page: undefined })}
              className={`px-2.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all ${payStatus === s ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              {s}
            </Link>
          ))}
        </div>

        {/* No-patient filter toggle */}
        <Link
          href={buildFinanceUrl(baseParams, { no_patient: noPatient ? undefined : '1', page: undefined })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            noPatient
              ? 'bg-[#FFB35C]/20 border-[#FFB35C]/40 text-[#FFB35C]'
              : 'border-white/10 text-muted-foreground hover:bg-white/8 hover:text-foreground'
          }`}
        >
          <UserX size={12} />
          Tanpa Pasien
        </Link>

        {hasActiveFilters && (
          <Link
            href={buildFinanceUrl(baseParams, { q: undefined, tx_type: undefined, no_patient: undefined, status: undefined, pay_status: undefined, page: undefined })}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={12} />
            Reset filter
          </Link>
        )}
      </div>

      <Suspense>
        <SearchInput defaultValue={q} />
      </Suspense>
    </div>
  )
}
