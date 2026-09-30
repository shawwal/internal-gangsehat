import { SkeletonRegion, PageHeaderSkeleton, StatCardsSkeleton, CardGridSkeleton } from '@/components/ui/Skeleton'

export default function PatientsIdPackagesLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} back />
      <StatCardsSkeleton count={4} className="grid grid-cols-2 sm:grid-cols-4 gap-3" />
      <CardGridSkeleton count={4} className="grid grid-cols-1 md:grid-cols-2 gap-4" height="h-48" />
    </SkeletonRegion>
  )
}
