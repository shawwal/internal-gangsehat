import { SkeletonRegion, PageHeaderSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

export default function DirectorSessionNoteSettingsLoading() {
  return (
    <SkeletonRegion>
      <PageHeaderSkeleton actions={0} />
      <TableSkeleton rows={8} cols={4} />
    </SkeletonRegion>
  )
}
