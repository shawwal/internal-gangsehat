import type { SupabaseClient } from '@supabase/supabase-js'

// Kehadiran ≠ Pembayaran: TA/Sesi/Paket progress must only count visits and
// packages that have a confirmed payment behind them — attendance alone is
// not enough. These helpers resolve "which visits/packages are paid" so
// counting logic (target-progress, KontrolTargetTab, etc.) can gate on it.

export async function fetchConfirmedVisitIds(
  supabase: SupabaseClient,
  visitIds: string[],
): Promise<Set<string>> {
  if (visitIds.length === 0) return new Set()

  const { data } = await supabase
    .from('transactions')
    .select('visit_id')
    .in('visit_id', visitIds)
    .eq('status', 'confirmed')

  return new Set((data ?? []).map((t) => t.visit_id as string).filter(Boolean))
}

// A package is "paid" if either its own order_id has a confirmed transaction
// (package purchased as a lump sum), or one of its linked visits does
// (session-by-session payment) — mirrors the dual-path logic already proven
// in app/actions/packages.ts::fetchPatientPackagesWithPayment.
export async function fetchPaidPackageIds(
  supabase: SupabaseClient,
  packages: { id: string; order_id: string | null }[],
  confirmedVisitIds: Set<string>,
  packageIdByVisitId: Map<string, string>,
): Promise<Set<string>> {
  const paid = new Set<string>()

  for (const visitId of confirmedVisitIds) {
    const packageId = packageIdByVisitId.get(visitId)
    if (packageId) paid.add(packageId)
  }

  const orderIds = packages.map((p) => p.order_id).filter((v): v is string => !!v)
  if (orderIds.length > 0) {
    const { data } = await supabase
      .from('transactions')
      .select('order_id')
      .in('order_id', orderIds)
      .eq('status', 'confirmed')

    const paidOrderIds = new Set((data ?? []).map((t) => t.order_id as string).filter(Boolean))
    for (const p of packages) {
      if (p.order_id && paidOrderIds.has(p.order_id)) paid.add(p.id)
    }
  }

  return paid
}
