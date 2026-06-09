'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII, encryptPatientPII, hashPhone } from '@/lib/encryption'

export interface PatientPlain {
  id: string
  name: string
  phone: string
  address: string | null
  birthDate: string | null
  gender: 'male' | 'female' | 'other' | null
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  // PII fields (AES-256-GCM encrypted at rest)
  idNumber: string | null
  emergencyContact: string | null
  // Medical
  blood_type: string | null
  allergies: string | null
  medical_notes: string | null
  // Demographics (migration 022)
  no_rm: string | null
  pekerjaan: string | null
  agama: string | null
  hobi: string | null
  kelurahan: string | null
  kecamatan: string | null
  kabupaten_kota: string | null
  provinsi: string | null
}

const SELECT_COLS =
  'id, encrypted_name, encrypted_phone, encrypted_address, encrypted_birth_date, ' +
  'encrypted_id_number, encrypted_emergency_contact, ' +
  'gender, blood_type, allergies, medical_notes, is_active, created_at, updated_at, ' +
  'no_rm, pekerjaan, agama, hobi, kelurahan, kecamatan, kabupaten_kota, provinsi'

function toPlain(row: Record<string, unknown>): PatientPlain {
  const pii = decryptPatientPII({
    encrypted_name:              (row.encrypted_name as string)              ?? '',
    encrypted_phone:             (row.encrypted_phone as string)             ?? '',
    encrypted_address:           (row.encrypted_address as string | undefined)           ?? undefined,
    encrypted_birth_date:        (row.encrypted_birth_date as string | undefined)        ?? undefined,
    encrypted_id_number:         (row.encrypted_id_number as string | undefined)         ?? undefined,
    encrypted_emergency_contact: (row.encrypted_emergency_contact as string | undefined) ?? undefined,
  })
  return {
    id:               row.id as string,
    name:             pii.name,
    phone:            pii.phone,
    address:          pii.address          ?? null,
    birthDate:        pii.birthDate        ?? null,
    idNumber:         pii.idNumber         ?? null,
    emergencyContact: pii.emergencyContact ?? null,
    gender:           (row.gender as PatientPlain['gender']) ?? null,
    blood_type:       (row.blood_type as string | null)      ?? null,
    allergies:        (row.allergies as string | null)       ?? null,
    medical_notes:    (row.medical_notes as string | null)   ?? null,
    isActive:         row.is_active as boolean,
    createdAt:        row.created_at as string,
    updatedAt:        (row.updated_at as string | null)      ?? null,
    no_rm:            (row.no_rm as string | null)           ?? null,
    pekerjaan:        (row.pekerjaan as string | null)       ?? null,
    agama:            (row.agama as string | null)           ?? null,
    hobi:             (row.hobi as string | null)            ?? null,
    kelurahan:        (row.kelurahan as string | null)       ?? null,
    kecamatan:        (row.kecamatan as string | null)       ?? null,
    kabupaten_kota:   (row.kabupaten_kota as string | null)  ?? null,
    provinsi:         (row.provinsi as string | null)        ?? null,
  }
}

export async function fetchPatients(): Promise<PatientPlain[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('patients')
    .select(SELECT_COLS)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return (data ?? []).map((row) => toPlain(row as unknown as Record<string, unknown>))
}

export async function fetchPatient(id: string): Promise<PatientPlain | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('patients')
    .select(SELECT_COLS)
    .eq('id', id)
    .single()
  return data ? toPlain(data as unknown as Record<string, unknown>) : null
}

export async function addPatient(input: {
  name: string
  phone: string
  address?: string
  birthDate?: string
  gender: 'male' | 'female' | 'other'
  // Optional plain-text demographics
  no_rm?: string
  pekerjaan?: string
  agama?: string
  hobi?: string
  kelurahan?: string
  kecamatan?: string
  kabupaten_kota?: string
  provinsi?: string
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
    phone_hash:           hashPhone(input.phone),
    no_rm:                input.no_rm          ?? null,
    pekerjaan:            input.pekerjaan      ?? null,
    agama:                input.agama          ?? null,
    hobi:                 input.hobi           ?? null,
    kelurahan:            input.kelurahan      ?? null,
    kecamatan:            input.kecamatan      ?? null,
    kabupaten_kota:       input.kabupaten_kota ?? null,
    provinsi:             input.provinsi       ?? null,
  })
  return { error: error?.message ?? null }
}

export interface UpdatePatientInput {
  name: string
  phone: string
  address?: string
  birthDate?: string
  gender?: 'male' | 'female' | 'other'
  idNumber?: string
  emergencyContact?: string
  blood_type?: string
  allergies?: string
  medical_notes?: string
  no_rm?: string
  pekerjaan?: string
  agama?: string
  hobi?: string
  kelurahan?: string
  kecamatan?: string
  kabupaten_kota?: string
  provinsi?: string
}

export async function updatePatient(
  id: string,
  input: UpdatePatientInput,
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const enc = encryptPatientPII({
    name:             input.name,
    phone:            input.phone,
    address:          input.address,
    birthDate:        input.birthDate,
    idNumber:         input.idNumber,
    emergencyContact: input.emergencyContact,
  })
  const { error } = await supabase.from('patients').update({
    encrypted_name:              enc.encrypted_name,
    encrypted_phone:             enc.encrypted_phone,
    encrypted_address:           enc.encrypted_address           ?? null,
    encrypted_birth_date:        enc.encrypted_birth_date        ?? null,
    encrypted_id_number:         enc.encrypted_id_number         ?? null,
    encrypted_emergency_contact: enc.encrypted_emergency_contact ?? null,
    phone_hash:                  hashPhone(input.phone),
    gender:        input.gender       ?? null,
    blood_type:    input.blood_type   ?? null,
    allergies:     input.allergies    ?? null,
    medical_notes: input.medical_notes ?? null,
    no_rm:         input.no_rm          ?? null,
    pekerjaan:     input.pekerjaan      ?? null,
    agama:         input.agama          ?? null,
    hobi:          input.hobi           ?? null,
    kelurahan:     input.kelurahan      ?? null,
    kecamatan:     input.kecamatan      ?? null,
    kabupaten_kota: input.kabupaten_kota ?? null,
    provinsi:      input.provinsi       ?? null,
  }).eq('id', id)
  return { error: error?.message ?? null }
}

/**
 * Backfill phone_hash for all existing patients that don't have one yet.
 * Decrypts each patient's encrypted_phone, normalizes, hashes, and writes back.
 * Safe to run multiple times (only processes rows where phone_hash IS NULL).
 * Returns { updated, errors } counts.
 */
export async function backfillPhoneHashes(): Promise<{ updated: number; errors: number }> {
  const supabase = await createClient()
  let updated = 0
  let errors = 0
  let offset = 0
  const BATCH = 100

  while (true) {
    const { data } = await supabase
      .from('patients')
      .select('id, encrypted_phone')
      .is('phone_hash', null)
      .range(offset, offset + BATCH - 1)

    if (!data || data.length === 0) break

    for (const row of data as { id: string; encrypted_phone: string }[]) {
      try {
        const { phone } = decryptPatientPII({
          encrypted_name:  '',
          encrypted_phone: row.encrypted_phone,
        })
        if (!phone) { errors++; continue }

        const hash = hashPhone(phone)
        const { error } = await supabase
          .from('patients')
          .update({ phone_hash: hash })
          .eq('id', row.id)
          .is('phone_hash', null) // guard: skip if another process already set it

        if (error) errors++
        else updated++
      } catch {
        errors++
      }
    }

    if (data.length < BATCH) break
    offset += BATCH
  }

  return { updated, errors }
}
