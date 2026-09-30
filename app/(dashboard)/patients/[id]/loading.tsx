import { SkeletonRegion, PageHeaderSkeleton, CardListSkeleton, DetailCardSkeleton } from '@/components/ui/Skeleton'

export default function PatientsIdLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} back />
      <DetailCardSkeleton rows={10} />
      <CardListSkeleton count={3} avatar={false} />
    </SkeletonRegion>
  )
}
