'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII, encryptPatientPII } from '@/lib/encryption'

export interface PatientPlain {
  id: string
  name: string
  phone: string
  address: string | null
  birthDate: string | null
  gender: 'male' | 'female' | 'other' | null
  isActive: boolean
  createdAt: string
}

const SELECT_COLS =
  'id, encrypted_name, encrypted_phone, encrypted_address, encrypted_birth_date, gender, is_active, created_at'

function toPlain(row: Record<string, unknown>): PatientPlain {
  const pii = decryptPatientPII({
    encrypted_name:       (row.encrypted_name as string)       ?? '',
    encrypted_phone:      (row.encrypted_phone as string)      ?? '',
    encrypted_address:    (row.encrypted_address  as string | undefined) ?? undefined,
    encrypted_birth_date: (row.encrypted_birth_date as string | undefined) ?? undefined,
  })
  return {
    id:        row.id as string,
    name:      pii.name,
    phone:     pii.phone,
    address:   pii.address  ?? null,
    birthDate: pii.birthDate ?? null,
    gender:    (row.gender as PatientPlain['gender']) ?? null,
    isActive:  row.is_active as boolean,
    createdAt: row.created_at as string,
  }
}

export async function fetchPatients(): Promise<PatientPlain[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('patients')
    .select(SELECT_COLS)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return (data ?? []).map(toPlain)
}

export async function fetchPatient(id: string): Promise<PatientPlain | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('patients')
    .select(SELECT_COLS)
    .eq('id', id)
    .single()
  return data ? toPlain(data as Record<string, unknown>) : null
}

export async function addPatient(input: {
  name: string
  phone: string
  address?: string
  birthDate?: string
  gender: 'male' | 'female' | 'other'
}): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const enc = encryptPatientPII({
    name:      input.name,
    phone:     input.phone,
    address:   input.address,
    birthDate: input.birthDate,
  })
  const { error } = await supabase.from('patients').insert({
    encrypted_name:       enc.encrypted_name,
    encrypted_phone:      enc.encrypted_phone,
    encrypted_address:    enc.encrypted_address   ?? null,
    encrypted_birth_date: enc.encrypted_birth_date ?? null,
    gender:               input.gender,
  })
  return { error: error?.message ?? null }
}
