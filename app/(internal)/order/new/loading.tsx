import { SkeletonRegion, PageHeaderSkeleton, FormSkeleton } from '@/components/ui/Skeleton'

export default function OrderNewLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} back />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <FormSkeleton fields={4} columns={2} />
          <FormSkeleton fields={4} columns={2} />
        </div>
        <FormSkeleton fields={3} columns={1} />
      </div>
    </SkeletonRegion>
  )
}
