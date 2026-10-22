'use client'

import { Suspense } from 'react'
import { DataCheckWorkspace } from '@/components/dataCheck/DataCheckWorkspace'
import { TableSkeleton } from '@/components/ui/Skeleton'

export default function DataCheckPage() {
  return (
    <Suspense fallback={<div className="md:p-6"><TableSkeleton rows={8} cols={7} /></div>}>
      <DataCheckWorkspace />
    </Suspense>
  )
}
