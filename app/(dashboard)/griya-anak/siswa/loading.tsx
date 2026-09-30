import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function GriyaAnakSiswaLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <FiltersSkeleton count={2} />
      <TableSkeleton rows={10} cols={8} />
    </SkeletonRegion>
  )
}
