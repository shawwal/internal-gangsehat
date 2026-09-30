import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakRingkasanLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <StatCardsSkeleton count={5} className="grid grid-cols-2 lg:grid-cols-5 gap-3" />
      <TableSkeleton rows={8} cols={5} />
    </SkeletonRegion>
  )
}
