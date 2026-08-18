'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Database, Loader2, RotateCcw } from 'lucide-react'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { NAV_GROUP_LABELS, type NavGroup } from '@/config/navigation'
import {
  getPagePermissions,
  setPagePermission,
  resetPagePermission,
  type PagePermissionRow,
  type PageRegistryRow,
} from '@/app/actions/pagePermissions'
import type { UserRole } from '@/types'

const ROLE_COLUMNS: { role: UserRole; label: string }[] = [
  { role: 'manager',                 label: 'Manager' },
  { role: 'finance',                 label: 'Finance' },
  { role: 'hr',                      label: 'HR' },
  { role: 'marketing',               label: 'Marketing' },
  { role: 'admin',                   label: 'Admin' },
  { role: 'therapist',               label: 'Therapist' },
  { role: 'staff',                   label: 'Staff' },
  { role: 'sport_massage_therapist', label: 'Sport Massage' },
]

type PageRow = PageRegistryRow & { group: NavGroup }

export default function AccessControlPage() {
  const [pages, setPages]         = useState<PageRow[]>([])
  const [overrides, setOverrides] = useState<PagePermissionRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [pending, setPending]     = useState<string | null>(null) // `${key}:${role}` currently saving

  useEffect(() => {
    getPagePermissions().then((res) => {
      if ('error' in res) { setError(res.error); setLoading(false); return }
      setPages(res.pages as PageRow[])
      setOverrides(res.overrides)
      setLoading(false)
    })
  }, [])

  const overrideMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const o of overrides) map.set(`${o.page_key}:${o.role}`, o.allowed)
    return map
  }, [overrides])

  const groupedPages = useMemo(() => {
    const groups = new Map<NavGroup, PageRow[]>()
    for (const page of pages) {
      if (!groups.has(page.group)) groups.set(page.group, [])
      groups.get(page.group)!.push(page)
    }
    return groups
  }, [pages])

  function effectiveAllowed(page: PageRow, role: UserRole): boolean {
    const cellKey = `${page.key}:${role}`
    const override = overrideMap.get(cellKey)
    if (override !== undefined) return override
    return page.defaultRoles.includes(role)
  }

  function isOverridden(page: PageRow, role: UserRole): boolean {
    return overrideMap.has(`${page.key}:${role}`)
  }

  async function handleToggle(page: PageRow, role: UserRole) {
    const cellKey = `${page.key}:${role}`
    const next = !effectiveAllowed(page, role)
    setPending(cellKey)
    const res = await setPagePermission(page.key, role, next)
    setPending(null)
    if ('error' in res) { setError(res.error); return }
    setOverrides((prev) => [
      ...prev.filter((o) => !(o.page_key === page.key && o.role === role)),
      { page_key: page.key, role, allowed: next },
    ])
  }

  async function handleReset(page: PageRow, role: UserRole) {
    const cellKey = `${page.key}:${role}`
    setPending(cellKey)
    const res = await resetPagePermission(page.key, role)
    setPending(null)
    if ('error' in res) { setError(res.error); return }
    setOverrides((prev) => prev.filter((o) => !(o.page_key === page.key && o.role === role)))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Akses Halaman</h1>
        <p className="text-sm text-muted-foreground">
          Atur halaman mana yang dapat diakses tiap role. Perubahan berlaku langsung di sidebar dan navigasi URL.
          Role <span className="font-medium">Director</span> selalu memiliki akses penuh dan tidak dapat dibatasi di sini.
        </p>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Database size={12} className="text-primary" />
          Halaman bertanda ikon ini juga langsung mengubah akses data (RLS) pada tabel terkait — bukan cuma tampilan halaman.
        </p>
      </div>

      {error && (
        <div className="glass-card p-4 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="glass-card flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Memuat...
        </div>
      ) : (
        <div className="glass-card p-5 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead>
              <tr>
                <th className="text-left font-semibold text-xs uppercase tracking-wide text-muted-foreground pb-3 pr-4 sticky left-0 bg-transparent">
                  Halaman
                </th>
                {ROLE_COLUMNS.map((col) => (
                  <th
                    key={col.role}
                    className="text-center font-semibold text-xs uppercase tracking-wide text-muted-foreground pb-3 px-2 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...groupedPages.entries()].map(([group, groupPages]) => (
                <Fragment key={group}>
                  <tr>
                    <td colSpan={ROLE_COLUMNS.length + 1} className="pt-4 pb-1.5 text-xs font-semibold text-primary">
                      {NAV_GROUP_LABELS[group]}
                    </td>
                  </tr>
                  {groupPages.map((page) => (
                    <tr key={page.key} className="border-t border-border/50">
                      <td className="py-2.5 pr-4 whitespace-nowrap sticky left-0 bg-transparent">
                        <span className="inline-flex items-center gap-1.5">
                          {page.label}
                          {page.tables.length > 0 && (
                            <span title={`Juga mengubah akses data pada: ${page.tables.join(', ')}`}>
                              <Database size={12} className="text-primary shrink-0" />
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] font-mono text-muted-foreground/70">{page.href}</span>
                      </td>
                      {ROLE_COLUMNS.map((col) => {
                        const cellKey = `${page.key}:${col.role}`
                        const allowed = effectiveAllowed(page, col.role)
                        const overridden = isOverridden(page, col.role)
                        const isPending = pending === cellKey
                        return (
                          <td key={col.role} className="py-2.5 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <ToggleSwitch
                                checked={allowed}
                                disabled={isPending}
                                onClick={() => handleToggle(page, col.role)}
                                label={`${page.label} — ${col.label}`}
                              />
                              {overridden && (
                                <button
                                  type="button"
                                  onClick={() => handleReset(page, col.role)}
                                  disabled={isPending}
                                  title="Kembalikan ke default"
                                  className="text-muted-foreground hover:text-primary disabled:opacity-50"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
