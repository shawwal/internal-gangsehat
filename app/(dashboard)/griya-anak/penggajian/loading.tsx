import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakPenggajianLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} />
      <FiltersSkeleton count={2} search={false} />
      <TableSkeleton rows={8} cols={8} />
    </SkeletonRegion>
  )
}
