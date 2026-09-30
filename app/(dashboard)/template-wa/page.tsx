'use client'

import { useEffect, useState } from 'react'
import {  } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { WaTemplateEditor } from '@/components/reminderTemplate/WaTemplateEditor'
import TemplateWaLoading from './loading'

// Branch admins/managers edit the WA templates for their own branch only
// (enforced server-side in app/actions/reminder-template.ts). The director
// uses /director/reminder-template, which also edits the global default.
export default function BranchTemplateWaPage() {
  const [branchId, setBranchId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setBranchId(null); return }
      const { data } = await sb.from('internal_profiles').select('branch_id').eq('id', user.id).single()
      setBranchId((data?.branch_id as string | null) ?? null)
    })
  }, [])

  if (branchId === undefined) {
    return <TemplateWaLoading />
  }
  if (!branchId) return <div className="glass-card p-10 text-center text-sm text-muted-foreground">Akun Anda belum terhubung ke cabang.</div>
  return <WaTemplateEditor lockedBranchId={branchId} />
}
