import { createClient } from '@/lib/supabase/server'
import { SportMassagePayrollView } from '@/components/sport-massage/payroll/PayrollView'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['director', 'manager', 'admin', 'hr']

/** Sport Massage payroll: attended sessions × per-therapist Layanan fee, per payroll period. */
export default async function SportMassagePayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: me }, { data: branchList }] = await Promise.all([
    supabase.from('internal_profiles').select('role, branch_id').eq('id', user!.id).single(),
    supabase.from('branches').select('id, name').eq('is_active', true).order('name'),
  ])

  const role = me?.role ?? ''
  if (!ALLOWED_ROLES.includes(role)) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Halaman ini hanya untuk direktur, manajer, admin, dan HR.</div>
  }

  const canSwitchBranch = role === 'director' || role === 'hr'
  const branches = (branchList ?? []) as { id: string; name: string }[]
  const initialBranchId = me?.branch_id ?? branches[0]?.id
  if (!initialBranchId) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Tidak ada cabang yang tersedia.</div>
  }

  if (!canSwitchBranch) {
    const { data: settings } = await supabase
      .from('branch_sport_massage_settings').select('enabled').eq('branch_id', initialBranchId).maybeSingle()
    if (!settings?.enabled) {
      return <div className="glass-card p-8 text-sm text-muted-foreground">Sport Massage belum diaktifkan untuk cabang ini.</div>
    }
  }

  return (
    <SportMassagePayrollView
      branches={canSwitchBranch ? branches : branches.filter((b) => b.id === initialBranchId)}
      initialBranchId={initialBranchId}
      canSwitchBranch={canSwitchBranch}
    />
  )
}
