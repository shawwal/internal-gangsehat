import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function JadwalHarianListLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <FiltersSkeleton count={3} />
      <TableSkeleton rows={10} cols={7} />
    </SkeletonRegion>
  )
}
