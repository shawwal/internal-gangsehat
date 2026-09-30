import { SkeletonRegion, PageHeaderSkeleton, FormSkeleton } from '@/components/ui/Skeleton'

export default function PatientsIdEditLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} back />
      <FormSkeleton fields={12} columns={2} />
    </SkeletonRegion>
  )
}
