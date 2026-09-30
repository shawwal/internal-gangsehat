import { SkeletonRegion, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakPengaturanLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <TableSkeleton rows={6} cols={4} />
    </SkeletonRegion>
  )
}
