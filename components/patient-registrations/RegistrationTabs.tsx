'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/patient-registrations', label: 'Pendaftaran' },
  { href: '/patient-registrations/accounts', label: 'Hubungkan Akun' },
]

/** Switches between new-patient registrations and gangsehat.com account link requests. */
export function RegistrationTabs({ pendingAccounts }: { pendingAccounts?: number }) {
  const pathname = usePathname()
  return (
    <div className="flex gap-2">
      {TABS.map((t) => {
        const active = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.href.endsWith('/accounts') && !!pendingAccounts && pendingAccounts > 0 && (
              <span className="ml-1.5 text-[11px] font-bold">({pendingAccounts})</span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
