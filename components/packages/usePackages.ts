'use client'

import { useEffect, useState } from 'react'
import { fetchPatient } from '@/app/actions/patients'
import { fetchPatientPackages, deletePatientPackage } from '@/app/actions/packages'
import { createClient } from '@/lib/supabase/client'
import type { PatientPackage } from './types'

export function usePackages(patientId: string) {
  const [packages, setPackages]     = useState<PatientPackage[]>([])
  const [patientName, setPatientName] = useState('')
  const [noRm, setNoRm]             = useState('')
  const [branchId, setBranchId]     = useState<string | null>(null)
  const [loading, setLoading]       = useState(true)

  async function loadProfile() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('internal_profiles')
      .select('branch_id')
      .eq('id', user.id)
      .single()
    setBranchId(profile?.branch_id ?? null)
  }

  async function load() {
    const [patient, pkgs] = await Promise.all([
      fetchPatient(patientId),
      fetchPatientPackages(patientId),
    ])
    setPatientName(patient?.name ?? '')
    setNoRm(patient?.no_rm ?? '')
    setPackages(pkgs)
    setLoading(false)
  }

  useEffect(() => { loadProfile().then(() => load()) }, [patientId])

  async function handleDelete(pkgId: string) {
    await deletePatientPackage(pkgId)
    load()
  }

  const stats = {
    total:     packages.length,
    active:    packages.filter((p) => p.status === 'active').length,
    completed: packages.filter((p) => p.status === 'completed').length,
    cancelled: packages.filter((p) => p.status === 'cancelled').length,
  }

  return { packages, patientName, noRm, branchId, loading, stats, load, handleDelete }
}
