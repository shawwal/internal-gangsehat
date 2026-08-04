'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface Branch { id: string; name: string }

export function OutstandingBranchFilter({ branches, branchId }: { branches: Branch[]; branchId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function navigate(next: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('branch', next)
    else params.delete('branch')
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={branchId}
      onChange={(e) => navigate(e.target.value)}
      className="h-9 px-3 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-colors"
    >
      <option value="">Semua Cabang</option>
      {branches.map((b) => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  )
}
