import type { createClient } from '@/lib/supabase/server'
import { countedSaleIds, type SalePayment } from './achievement'

type ServerClient = Awaited<ReturnType<typeof createClient>>

// Columns countedSaleIds needs — merged into whatever the caller selects.
const RULE_COLUMNS = ['id', 'patient_id', 'category', 'payment_status', 'transaction_date', 'created_at', 'harga', 'discount', 'amount', 'order_id']

// How far back an installment's opening payment is looked for.
const LOOKBACK_MONTHS = 12

/**
 * Income transactions of a branch + window that count as sales: the first
 * LUNAS/DP payment of each purchase (lib/metrics/achievement `countedSaleIds`).
 * Later installments of a purchase — in the window or opened up to 12 months
 * before it — are left out, so one purchase is one sale everywhere.
 */
export async function fetchCountedSales<T extends { id: string }>(
  db: { from: ServerClient['from'] },
  opts: { branchId: string; start: string; end: string; categories: string[]; columns: string; fullLunasIsNewSale?: boolean },
): Promise<T[]> {
  const { branchId, start, end, categories } = opts
  if (!categories.length) return []
  const columns = [...new Set([...opts.columns.split(',').map((c) => c.trim()).filter(Boolean), ...RULE_COLUMNS])].join(', ')

  const base = (select: string) => db
    .from('transactions')
    .select(select)
    .eq('branch_id', branchId)
    .eq('type', 'income')
    .neq('status', 'rejected')
    .in('category', categories)

  const { data, error } = await base(columns)
    .gte('transaction_date', start)
    .lte('transaction_date', end)
    .limit(20000)
  if (error || !data) return []
  const rows = data as unknown as (T & SalePayment)[]

  const lookbackStart = new Date(`${start}T00:00:00Z`)
  lookbackStart.setUTCMonth(lookbackStart.getUTCMonth() - LOOKBACK_MONTHS)
  const patientIds = [...new Set(rows.map((r) => r.patient_id).filter((x): x is string => !!x))]
  const history: SalePayment[] = []
  for (let i = 0; i < patientIds.length; i += 300) {
    const { data: earlier } = await base(RULE_COLUMNS.join(', '))
      .in('patient_id', patientIds.slice(i, i + 300))
      .gte('transaction_date', lookbackStart.toISOString().slice(0, 10))
      .lt('transaction_date', start)
      .limit(20000)
    history.push(...((earlier ?? []) as unknown as SalePayment[]))
  }

  const counted = countedSaleIds([...history, ...rows], { fullLunasIsNewSale: opts.fullLunasIsNewSale })
  return rows
    .filter((r) => counted.has(r.id))
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
}
