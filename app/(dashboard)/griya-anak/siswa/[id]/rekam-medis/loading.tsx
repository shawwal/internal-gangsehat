import { SkeletonRegion, PageHeaderSkeleton, CardListSkeleton, DetailCardSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakSiswaIdRekamMedisLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} back />
      <DetailCardSkeleton rows={10} />
      <CardListSkeleton count={3} avatar={false} />
    </SkeletonRegion>
  )
}
