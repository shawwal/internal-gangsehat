import { SkeletonRegion, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function FinanceTransactionsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={2} />
      <TableSkeleton rows={10} cols={8} />
    </SkeletonRegion>
  )
}
