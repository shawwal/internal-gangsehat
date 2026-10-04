'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface Options {
  // Off while the form is locked/completed — autosave only ever writes drafts.
  enabled?: boolean
  // Idle delay after the last change before saving, for inputs that never
  // blur (checkbox/chip clicks on Safari, which doesn't focus buttons).
  delay?: number
}

// Autosaves a form's draft so an accidentally closed tab/modal doesn't lose
// what the therapist typed. Saves when focus leaves a field (attach `onBlur`
// to the form container), after `delay` ms of inactivity, when the tab is
// hidden/closed, and when the form unmounts (in-app navigation, modal close).
//
// Pass `value = null` while the record is still loading: the first non-null
// value is taken as what's already on the server, so merely opening a form
// never writes an empty draft row.
export function useAutoSave<T>(
  value: T | null,
  save: (value: T) => Promise<{ error: string | null }>,
  { enabled = true, delay = 3000 }: Options = {},
) {
  const serialized = value == null ? null : JSON.stringify(value)

  const [status, setStatus]   = useState<AutoSaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const baselineRef = useRef<string | null>(null)
  const runningRef  = useRef<Promise<void> | null>(null)
  const pendingRef  = useRef(false)
  const latestRef   = useRef({ value, serialized, save, enabled })

  // Runs before the effects below, so they and every handler see this render.
  useLayoutEffect(() => {
    latestRef.current = { value, serialized, save, enabled }
    if (baselineRef.current === null && serialized !== null) baselineRef.current = serialized
  })

  // Resolves once every queued save has finished — await it before completing
  // the record so a late draft write can't land after the completed one.
  const flush = useCallback((): Promise<void> => {
    if (runningRef.current) { pendingRef.current = true; return runningRef.current }

    async function run() {
      do {
        pendingRef.current = false
        const { value, serialized, save, enabled } = latestRef.current
        if (!enabled || value == null || serialized === baselineRef.current) break
        setStatus('saving')
        const { error } = await save(value)
        if (error) { setStatus('error'); break }
        baselineRef.current = serialized
        setStatus('saved')
        setSavedAt(new Date())
      } while (pendingRef.current)
    }

    runningRef.current = run().finally(() => { runningRef.current = null })
    return runningRef.current
  }, [])

  // Record a save done outside the hook (manual "Simpan Draft", complete) so
  // the same content isn't re-sent.
  const markSaved = useCallback((saved: T) => {
    baselineRef.current = JSON.stringify(saved)
  }, [])

  // Idle-debounced save.
  useEffect(() => {
    if (!enabled || serialized === null || serialized === baselineRef.current) return
    const t = setTimeout(() => { void flush() }, delay)
    return () => clearTimeout(t)
  }, [serialized, enabled, delay, flush])

  // Tab hidden / closed / page unloaded — best-effort save, plus the browser's
  // "leave site?" prompt while there are unsaved changes.
  useEffect(() => {
    function onHide() { if (document.visibilityState === 'hidden') void flush() }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      const { enabled, serialized } = latestRef.current
      if (!enabled || serialized === null) return
      if (serialized !== baselineRef.current || runningRef.current) {
        void flush()
        e.preventDefault()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    function onPageHide() { void flush() }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [flush])

  // Unmount (navigating away within the app, closing a modal).
  useEffect(() => () => { void flush() }, [flush])

  return { status, savedAt, flush, markSaved, onBlur: () => { void flush() } }
}
