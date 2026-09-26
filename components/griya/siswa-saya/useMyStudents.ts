'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchMyGriyaStudents, type MyStudent } from '@/app/actions/griyaMyStudents'

export function useMyStudents(ready: boolean) {
  const [students, setStudents] = useState<MyStudent[]>([])
  const [today, setToday] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((r: Awaited<ReturnType<typeof fetchMyGriyaStudents>>) => {
    setStudents(r.students); setToday(r.today); setError(r.error ?? null)
    setLoading(false)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true); setError(null)
    apply(await fetchMyGriyaStudents())
  }, [apply])

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetchMyGriyaStudents().then((r) => { if (!cancelled) apply(r) })
    return () => { cancelled = true }
  }, [ready, apply])

  return { students, today, loading, error, reload }
}
