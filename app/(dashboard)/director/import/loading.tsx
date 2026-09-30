import { SkeletonRegion, PageHeaderSkeleton, FormSkeleton } from '@/components/ui/Skeleton'

export default function DirectorImportLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} back />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FormSkeleton fields={2} columns={1} />
        <FormSkeleton fields={2} columns={1} />
      </div>
    </SkeletonRegion>
  )
}
