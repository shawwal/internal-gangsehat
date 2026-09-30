import { Skeleton, SkeletonRegion, PageHeaderSkeleton, TabsSkeleton, CardGridSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakTokoLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <TabsSkeleton count={2} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CardGridSkeleton count={6} className="grid grid-cols-2 xl:grid-cols-3 gap-4" height="h-36" />
        </div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </SkeletonRegion>
  )
}
