import { SkeletonRegion, PageHeaderSkeleton, FormSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakSiswaIdTerapiAwalVisitIdLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} back />
      <FormSkeleton fields={10} columns={1} />
    </SkeletonRegion>
  )
}
