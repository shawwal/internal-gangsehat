import { SkeletonRegion, CardListSkeleton, DetailCardSkeleton } from '@/components/ui/Skeleton'

export default function ResumeTokenLoading() {
  return (
    <SkeletonRegion className="max-w-3xl mx-auto p-6 space-y-6">
      <DetailCardSkeleton rows={12} />
      <CardListSkeleton count={4} avatar={false} />
    </SkeletonRegion>
  )
}
