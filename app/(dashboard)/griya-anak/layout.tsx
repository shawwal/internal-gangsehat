import { loadGriyaBranchContext } from '@/lib/griyaBranchServer'
import { GriyaBranchPicker, GriyaBranchProvider } from '@/components/griya/GriyaBranchProvider'

export const dynamic = 'force-dynamic'

// Every Griya page works on one Griya-enabled branch (Griya Anak, Nafaya Centre, …).
// Director and Griya admins pick it here — see lib/griyaBranch.ts.
export default async function GriyaAnakLayout({ children }: { children: React.ReactNode }) {
  const ctx = await loadGriyaBranchContext()
  return (
    <GriyaBranchProvider value={ctx}>
      <GriyaBranchPicker />
      {children}
    </GriyaBranchProvider>
  )
}
