import { SkeletonRegion, PageHeaderSkeleton, FiltersSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function FinanceReportsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={1} />
      <FiltersSkeleton count={2} search={false} />
      <TableSkeleton rows={8} cols={6} />
    </SkeletonRegion>
  )
}
