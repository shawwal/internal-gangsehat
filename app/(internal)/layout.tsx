import { AppShell } from '@/components/internal'

export const dynamic = 'force-dynamic'

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}
