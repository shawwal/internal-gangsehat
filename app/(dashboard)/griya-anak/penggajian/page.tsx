import { PayrollWorkspaceView } from '@/components/payroll/PayrollWorkspaceView'

// Same workflow and tables as /payroll, limited to Griya Anak branches. The
// Griya sheet's rules (operasional penuh ≥ 75%, Tugas, KPI admin) are options
// on each employee's compensation — see supabase/126-griya-payroll.sql.
export default function GriyaPenggajianPage() {
  return <PayrollWorkspaceView scope="griya" />
}
