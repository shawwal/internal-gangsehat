import { SkeletonRegion, PageHeaderSkeleton, FormSkeleton } from '@/components/ui/Skeleton'

export default function VisitsVisitIdSessionNoteLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} back />
      <FormSkeleton fields={10} columns={1} />
    </SkeletonRegion>
  )
}
