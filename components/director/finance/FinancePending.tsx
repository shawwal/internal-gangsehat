'use client'

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from 'react'

// A searchParams change (period / branch) keeps the old page on screen until
// the server re-renders — loading.tsx only covers the first visit. Filter
// navigations run inside this shared transition so the body can show a
// skeleton meanwhile.
const PendingContext = createContext<{ isPending: boolean; startTransition: TransitionStartFunction } | null>(null)

export function FinancePendingProvider({ children }: { children: ReactNode }) {
  const [isPending, startTransition] = useTransition()
  return <PendingContext.Provider value={{ isPending, startTransition }}>{children}</PendingContext.Provider>
}

export function useFinancePending() {
  const ctx = useContext(PendingContext)
  const [isPending, startTransition] = useTransition()
  return ctx ?? { isPending, startTransition }
}

/** Hides (keeps mounted) `children` and shows `fallback` while a filter navigation is pending. */
export function FinancePendingContent({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { isPending } = useFinancePending()
  return (
    <>
      {isPending && fallback}
      <div hidden={isPending} className="space-y-6">{children}</div>
    </>
  )
}
