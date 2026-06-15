'use server'

import { createClient } from '@/lib/supabase/server'
import { decryptPatientPII, encryptPatientPII, hashPhone } from '@/lib/encryption'
import { normalizeBirthDate } from '@/lib/dates'

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
  keluhan: string | null
}

const SELECT_COLS =
  'id, encrypted_name, encrypted_phone, encrypted_address, encrypted_birth_date, ' +
  'encrypted_id_number, encrypted_emergency_contact, ' +
  'gender, blood_type, allergies, medical_notes, is_active, created_at, updated_at, ' +
  'no_rm, pekerjaan, agama, hobi, kelurahan, kecamatan, kabupaten_kota, provinsi, keluhan'

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
    birthDate:        normalizeBirthDate(pii.birthDate),
    idNumber:         pii.idNumber         ?? null,
    emergencyContact: pii.emergencyContact ?? null,
    gender:           (row.gender as PatientPlain['gender']) ?? null,
    blood_type:       (row.blood_type as string | null)      ?? null,
    // allergies is text[] in DB — join to a single display string
    allergies: Array.isArray(row.allergies)
      ? (row.allergies as string[]).join(', ') || null
      : (row.allergies as string | null) ?? null,
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
    keluhan:          (row.keluhan as string | null)         ?? null,
  }
}

export async function fetchPatients(): Promise<PatientPlain[]> {
  const supabase = await createClient()
  // PostgREST caps each request at 1000 rows — page through with .range()
  const BATCH = 1000
  const rows: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('patients')
      .select(SELECT_COLS)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, from + BATCH - 1)
    if (error || !data || data.length === 0) break
    rows.push(...(data as unknown as Record<string, unknown>[]))
    if (data.length < BATCH) break
    from += BATCH
  }
  return rows.map(toPlain)
}

export async function searchPatients(term: string): Promise<PatientPlain[]> {
  const q = term.trim().toLowerCase()
  if (q.length < 2) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('patients')
    .select(SELECT_COLS)
    .eq('is_active', true)
    .ilike('name_normalized', `%${q}%`)
    .order('name_normalized', { ascending: true })
    .limit(20)
  return (data ?? []).map((row) => toPlain(row as unknown as Record<string, unknown>))
}

export interface PatientsPageParams {
  page: number
  pageSize: number
  gender: 'all' | 'male' | 'female' | 'other'
  search: string
  sortField: 'name' | 'created_at' | 'no_rm'
  sortOrder: 'asc' | 'desc'
}

export interface PatientsPageResult {
  patients: PatientPlain[]
  total: number
}

/**
 * Server-side paginated patient list. Only the requested page is decrypted
 * and sent to the client.
 *
 * Fast path: gender filter, created_at/no_rm sort, and count all happen in
 * Postgres — one request via `{ count: 'exact' }` + `.range()`.
 *
 * Slow path (search term, or sort by name): name/phone are AES-encrypted at
 * rest so Postgres can't ilike/order them — scan in 1000-row batches
 * server-side, decrypt only name+phone to filter/sort, then fully decrypt
 * just the requested page.
 */
export async function fetchPatientsPage(params: PatientsPageParams): Promise<PatientsPageResult> {
  const supabase = await createClient()
  const { page, pageSize, gender, sortField, sortOrder } = params
  const search = params.search.trim().toLowerCase()
  const ascending = sortOrder === 'asc'
  const from = (page - 1) * pageSize

  // Fast path — everything expressible in SQL
  if (!search && sortField !== 'name') {
    let query = supabase
      .from('patients')
      .select(SELECT_COLS, { count: 'exact' })
      .eq('is_active', true)
    if (gender !== 'all') query = query.eq('gender', gender)
    const { data, count } = await query
      .order(sortField, { ascending, nullsFirst: false })
      .order('id', { ascending: true }) // stable tiebreaker across pages
      .range(from, from + pageSize - 1)
    return {
      patients: (data ?? []).map((row) => toPlain(row as unknown as Record<string, unknown>)),
      total: count ?? 0,
    }
  }

  // Slow path — encrypted name/phone force an app-side scan
  const BATCH = 1000
  const rows: Record<string, unknown>[] = []
  let offset = 0
  while (true) {
    let query = supabase
      .from('patients')
      .select(SELECT_COLS)
      .eq('is_active', true)
    if (gender !== 'all') query = query.eq('gender', gender)
    const { data, error } = await query
      .order('id', { ascending: true })
      .range(offset, offset + BATCH - 1)
    if (error || !data || data.length === 0) break
    rows.push(...(data as unknown as Record<string, unknown>[]))
    if (data.length < BATCH) break
    offset += BATCH
  }

  // Decrypt only name+phone for filtering/sorting
  let candidates = rows.map((row) => {
    const pii = decryptPatientPII({
      encrypted_name:  (row.encrypted_name as string)  ?? '',
      encrypted_phone: (row.encrypted_phone as string) ?? '',
    })
    return { row, name: pii.name ?? '', phone: pii.phone ?? '' }
  })

  if (search) {
    candidates = candidates.filter(
      (c) => c.name.toLowerCase().includes(search) || c.phone.includes(search),
    )
  }

  candidates.sort((a, b) => {
    const mul = ascending ? 1 : -1
    if (sortField === 'name') return mul * a.name.localeCompare(b.name, 'id')
    if (sortField === 'no_rm') {
      return mul * ((a.row.no_rm as string ?? '').localeCompare(b.row.no_rm as string ?? '', 'id'))
    }
    return mul * (new Date(a.row.created_at as string).getTime() - new Date(b.row.created_at as string).getTime())
  })

  const pageRows = candidates.slice(from, from + pageSize)
  return {
    patients: pageRows.map((c) => toPlain(c.row)),
    total: candidates.length,
  }
}

export interface PatientStats {
  total: number
  male: number
  female: number
  other: number
}

/** Head-only count queries — zero rows fetched. */
export async function fetchPatientStats(): Promise<PatientStats> {
  const supabase = await createClient()
  const base = () =>
    supabase.from('patients').select('*', { count: 'exact', head: true }).eq('is_active', true)
  const [total, male, female, other] = await Promise.all([
    base(),
    base().eq('gender', 'male'),
    base().eq('gender', 'female'),
    base().eq('gender', 'other'),
  ])
  return {
    total:  total.count  ?? 0,
    male:   male.count   ?? 0,
    female: female.count ?? 0,
    other:  other.count  ?? 0,
  }
}

export async function fetchPatientsForExport(params: {
  gender:    'all' | 'male' | 'female' | 'other'
  search:    string
  sortField: 'name' | 'created_at' | 'no_rm'
  sortOrder: 'asc' | 'desc'
}): Promise<PatientPlain[]> {
  const supabase = await createClient()
  const { gender, sortField, sortOrder } = params
  const search   = params.search.trim().toLowerCase()
  const ascending = sortOrder === 'asc'
  const BATCH     = 1000

  const fetchBatched = async (ordered: boolean) => {
    const rows: Record<string, unknown>[] = []
    let from = 0
    while (true) {
      let q = supabase.from('patients').select(SELECT_COLS).eq('is_active', true)
      if (gender !== 'all') q = q.eq('gender', gender)
      if (ordered) q = q.order(sortField, { ascending, nullsFirst: false }).order('id', { ascending: true })
      else q = q.order('id', { ascending: true })
      const { data, error } = await q.range(from, from + BATCH - 1)
      if (error || !data || data.length === 0) break
      rows.push(...(data as unknown as Record<string, unknown>[]))
      if (data.length < BATCH) break
      from += BATCH
    }
    return rows
  }

  if (!search && sortField !== 'name') {
    const rows = await fetchBatched(true)
    return rows.map(toPlain)
  }

  const rows = await fetchBatched(false)
  let candidates = rows.map((row) => {
    const pii = decryptPatientPII({
      encrypted_name:  (row.encrypted_name as string)  ?? '',
      encrypted_phone: (row.encrypted_phone as string) ?? '',
    })
    return { row, name: pii.name ?? '', phone: pii.phone ?? '' }
  })
  if (search) {
    candidates = candidates.filter(
      (c) => c.name.toLowerCase().includes(search) || c.phone.includes(search),
    )
  }
  candidates.sort((a, b) => {
    const mul = ascending ? 1 : -1
    if (sortField === 'name') return mul * a.name.localeCompare(b.name, 'id')
    if (sortField === 'no_rm') {
      return mul * ((a.row.no_rm as string ?? '').localeCompare(b.row.no_rm as string ?? '', 'id'))
    }
    return mul * (new Date(a.row.created_at as string).getTime() - new Date(b.row.created_at as string).getTime())
  })
  return candidates.map((c) => toPlain(c.row))
}

export async function fetchPatientsPageWithStats(
  params: PatientsPageParams,
): Promise<PatientsPageResult & { stats: PatientStats }> {
  const [pageResult, stats] = await Promise.all([fetchPatientsPage(params), fetchPatientStats()])
  return { ...pageResult, stats }
}

export async function deletePatient(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('patients')
    .update({ is_active: false })
    .eq('id', id)
  return { error: error?.message ?? null }
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
  keluhan?: string
}): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient()
  const enc = encryptPatientPII({
    name:      input.name,
    phone:     input.phone,
    address:   input.address,
    birthDate: input.birthDate,
  })
  const { data, error } = await supabase.from('patients').insert({
    encrypted_name:       enc.encrypted_name,
    encrypted_phone:      enc.encrypted_phone,
    encrypted_address:    enc.encrypted_address   ?? null,
    encrypted_birth_date: enc.encrypted_birth_date ?? null,
    gender:               input.gender,
    phone_hash:           hashPhone(input.phone),
    name_normalized:      input.name.trim().toLowerCase(),
    no_rm:                input.no_rm          ?? null,
    pekerjaan:            input.pekerjaan      ?? null,
    agama:                input.agama          ?? null,
    hobi:                 input.hobi           ?? null,
    kelurahan:            input.kelurahan      ?? null,
    kecamatan:            input.kecamatan      ?? null,
    kabupaten_kota:       input.kabupaten_kota ?? null,
    provinsi:             input.provinsi       ?? null,
    keluhan:              input.keluhan        ?? null,
  }).select('id').single()
  return { error: error?.message ?? null, id: data?.id ?? null }
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
    name_normalized:             input.name.trim().toLowerCase(),
    gender:        input.gender        ?? null,
    blood_type:    input.blood_type    ?? null,
    // allergies is text[] in DB — store as single-element array
    allergies:     input.allergies ? [input.allergies] : null,
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
 * Backfill name_normalized for all existing patients that don't have it yet.
 * Decrypts encrypted_name and writes lower(trim(name)) into name_normalized.
 * Safe to run multiple times — only processes rows where name_normalized IS NULL.
 */
export async function backfillNameNormalized(): Promise<{ updated: number; errors: number }> {
  const supabase = await createClient()
  let updated = 0
  let errors = 0
  let offset = 0
  const BATCH = 100

  while (true) {
    const { data } = await supabase
      .from('patients')
      .select('id, encrypted_name')
      .is('name_normalized', null)
      .range(offset, offset + BATCH - 1)

    if (!data || data.length === 0) break

    for (const row of data as { id: string; encrypted_name: string }[]) {
      try {
        const { name } = decryptPatientPII({
          encrypted_name:  row.encrypted_name,
          encrypted_phone: '',
        })
        if (!name) { errors++; continue }
        const { error } = await supabase
          .from('patients')
          .update({ name_normalized: name.trim().toLowerCase() })
          .eq('id', row.id)
          .is('name_normalized', null)
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
