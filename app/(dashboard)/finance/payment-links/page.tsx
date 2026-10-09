import { createClient } from '@/lib/supabase/server'
import { PaymentLinksWorkspace } from '@/components/payment-links/PaymentLinksWorkspace'

export const dynamic = 'force-dynamic'

export default async function PaymentLinksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('internal_profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  return <PaymentLinksWorkspace showBranch={profile?.role === 'director'} />
}
