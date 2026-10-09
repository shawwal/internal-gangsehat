'use client'

import { useTokoBranch } from '@/hooks/useTokoBranch'
import { TokoSkeleton, TokoWorkspace } from '@/components/toko/TokoWorkspace'

/** Toko for fisioterapi branches — same shop as Toko Griya Anak, any branch. */
export default function TokoPage() {
  const { loading, branchId, branches, setBranchId } = useTokoBranch()

  if (loading) return <TokoSkeleton />
  if (!branchId) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Akun Anda belum terhubung ke cabang.</div>
  }

  return (
    <TokoWorkspace
      branchId={branchId}
      variant="fisio"
      title="Toko"
      headerExtra={branches.length > 1 && (
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          aria-label="Cabang"
          className="px-3 py-2 border border-border rounded-xl text-sm bg-input cursor-pointer"
        >
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
    />
  )
}
