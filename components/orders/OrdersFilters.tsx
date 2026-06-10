import { Search, RefreshCw } from 'lucide-react'
import { Select } from './Select'
import { MONTHS, YEARS, STATUS_OPTIONS, PAYMENT_OPTIONS } from './constants'

interface OrdersFiltersProps {
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  paymentFilter: string
  setPaymentFilter: (v: string) => void
  month: string
  setMonth: (v: string) => void
  year: string
  setYear: (v: string) => void
  loading: boolean
  onRefresh: () => void
}

export function OrdersFilters({
  search, setSearch,
  statusFilter, setStatusFilter,
  paymentFilter, setPaymentFilter,
  month, setMonth,
  year, setYear,
  loading, onRefresh,
}: OrdersFiltersProps) {
  return (
    <div className="glass-card p-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pasien atau layanan..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          />
        </div>

        <Select value={statusFilter}  onChange={setStatusFilter}  options={STATUS_OPTIONS} />
        <Select value={paymentFilter} onChange={setPaymentFilter} options={PAYMENT_OPTIONS} />
        <Select value={month}         onChange={setMonth}         options={MONTHS} />
        <Select value={year}          onChange={setYear}          options={[{ value: '', label: 'Semua Tahun' }, ...YEARS]} />

        <button
          onClick={onRefresh}
          className="p-2 border border-border rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Refresh data"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )
}
