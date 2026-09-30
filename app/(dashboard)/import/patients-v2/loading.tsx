import { SkeletonRegion, PageHeaderSkeleton, FormSkeleton } from '@/components/ui/Skeleton'

export default function ImportPatientsV2Loading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} back />
      <FormSkeleton fields={2} columns={1} />
    </SkeletonRegion>
  )
}
