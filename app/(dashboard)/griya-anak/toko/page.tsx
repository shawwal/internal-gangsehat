'use client'

import { useGriyaBranch } from '@/hooks/useGriyaBranch'
import { TokoSkeleton, TokoWorkspace } from '@/components/toko/TokoWorkspace'

export default function GriyaTokoPage() {
  const { loading, branchId, enabled } = useGriyaBranch()

  if (loading) return <TokoSkeleton />
  if (!branchId || !enabled) {
    return <div className="glass-card p-8 text-sm text-muted-foreground">Fitur Toko Griya Anak belum aktif untuk cabang ini.</div>
  }

  return <TokoWorkspace branchId={branchId} variant="griya" title="Toko Griya Anak" />
}
