import { SkeletonRegion, PageHeaderSkeleton, FormSkeleton } from '@/components/ui/Skeleton'

export default function DirectorImportPackagesLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} back />
      <FormSkeleton fields={2} columns={1} />
    </SkeletonRegion>
  )
}
