import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function PatientsIdVisitsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} back />
      <StatCardsSkeleton count={4} className="grid grid-cols-2 sm:grid-cols-4 gap-3" />
      <TableSkeleton rows={10} cols={7} />
    </SkeletonRegion>
  )
}
