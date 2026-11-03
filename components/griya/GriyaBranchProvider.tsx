'use client'

import { createContext, useContext, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Building2, Loader2 } from 'lucide-react'
import { writeGriyaBranchCookie } from '@/lib/griyaBranch'
import type { GriyaBranchContextValue } from '@/lib/griyaBranchServer'

const GriyaBranchContext = createContext<GriyaBranchContextValue | null>(null)

/** Resolved once per /griya-anak visit by app/(dashboard)/griya-anak/layout.tsx. */
export function GriyaBranchProvider({ value, children }: { value: GriyaBranchContextValue; children: React.ReactNode }) {
  return <GriyaBranchContext.Provider value={value}>{children}</GriyaBranchContext.Provider>
}

export function useGriyaBranchContext(): GriyaBranchContextValue | null {
  return useContext(GriyaBranchContext)
}

// Penggajian Griya Anak has its own branch picker (PayrollWorkspaceView).
const OWN_PICKER_PATHS = ['/griya-anak/penggajian']

/** Branch switch for director / Griya admins. A switch reloads the page so every
 *  query — client and server — runs against the new branch. */
export function GriyaBranchPicker() {
  const ctx = useGriyaBranchContext()
  const pathname = usePathname()
  const [switching, setSwitching] = useState(false)

  if (!ctx?.canSwitch || ctx.branches.length < 2) return null
  if (OWN_PICKER_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return null

  function pick(id: string) {
    if (!id || id === ctx?.branchId) return
    setSwitching(true)
    writeGriyaBranchCookie(id)
    // A student / visit page belongs to one branch — go back to its list.
    const detail = pathname.match(/^\/griya-anak\/siswa\/[^/]+/)
    if (detail) window.location.href = '/griya-anak/siswa'
    else window.location.reload()
  }

  return (
    <div className="flex justify-end mb-4">
      <label className="glass-card inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm">
        {switching
          ? <Loader2 size={15} className="animate-spin text-primary shrink-0" />
          : <Building2 size={15} className="text-primary shrink-0" />}
        <span className="text-muted-foreground shrink-0">Cabang</span>
        <select
          value={ctx.branchId ?? ''}
          disabled={switching}
          onChange={(e) => pick(e.target.value)}
          className="max-w-[60vw] bg-transparent text-foreground font-medium focus:outline-none cursor-pointer"
        >
          {ctx.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </label>
    </div>
  )
}
