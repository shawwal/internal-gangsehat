import { Skeleton, SkeletonRegion, PageHeaderSkeleton, FormSkeleton } from '@/components/ui/Skeleton'

export default function TemplateWaLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FormSkeleton fields={4} columns={1} />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </SkeletonRegion>
  )
}
