import { redirect } from 'next/navigation'

// The manual payroll page was replaced by the payroll engine workspace.
export default function LegacyPayrollRedirect() {
  redirect('/payroll')
}
