import { redirect } from 'next/navigation'

// Validation Center was retired — Data Kunjungan Klinik covers fisio + Sport Massage sessions.
export default function SessionsPage() {
  redirect('/jadwal-harian/list')
}
