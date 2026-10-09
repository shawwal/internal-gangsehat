'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt, encrypt, encryptPatientPII, hashPhone } from '@/lib/encryption'
import { phoneHashIfFree } from '@/lib/patientPhoneHash'
import { logActivity } from '@/lib/activityLog'
import { normalizeSumber } from '@/lib/griyaSumber'

// Public self-registrations from gangsehat.com/daftar (migration 093).
// PII is encrypted at rest, so all reads/writes go through these server actions:
// role + branch are verified against the caller's session, then the service
// client does the work.

const REVIEW_ROLES = ['director', 'manager', 'admin']
const PAGE_SIZE = 10

export type RegistrationStatus = 'pending' | 'approved' | 'rejected'
/** 'griya' = Griya Anak child form (approval also enrols in griya_students). */
export type RegistrationType = 'umum' | 'griya'

export interface RegistrationFields {
  name: string
  phone: string
  gender: 'male' | 'female' | 'other' | null
  birthDate: string
  address: string
  provinsi: string
  kabupatenKota: string
  kecamatan: string
  kelurahan: string
  agama: string
  pekerjaan: string
  keluhan: string
  hobi: string
  // Griya Anak only (empty for 'umum')
  namaPanggilan: string
  namaIbu: string
  pekerjaanIbu: string
  namaAyah: string
  pekerjaanAyah: string
  sumber: string
}

export interface RegistrationRow extends RegistrationFields {
  id: string
  createdAt: string
  branchId: string
  branchName: string | null
  status: RegistrationStatus
  rejectionNote: string | null
  reviewedAt: string | null
  reviewerName: string | null
  patientId: string | null
  type: RegistrationType
  /** Griya Anak registration — approval also enrols the child in griya_students. */
  isGriya: boolean
  /** Existing patient with the same phone number, if any. */
  duplicatePatientId: string | null
  /** Affiliate code the patient registered with (gangsehat.com/daftar?ref=). */
  affiliateCode: string | null
}

export interface RegistrationStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

interface Reviewer {
  id: string
  role: string
  branchId: string | null
}

const nz = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

async function getReviewer(): Promise<Reviewer | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await supabase
    .from('internal_profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()
  if (!me || !REVIEW_ROLES.includes(me.role)) return null
  return { id: user.id, role: me.role, branchId: me.branch_id }
}

/** Loads a registration the reviewer may act on (own branch unless director). */
async function getScopedRegistration(reviewer: Reviewer, id: string) {
  const { data } = await createAdminClient()
    .from('patient_registrations')
    .select('id, branch_id, status, patient_id, registration_type')
    .eq('id', id)
    .single()
  if (!data) return null
  if (reviewer.role !== 'director' && data.branch_id !== reviewer.branchId) return null
  return data
}

function safeDecrypt(v: string | null): string {
  if (!v) return ''
  try { return decrypt(v) } catch { return '' }
}

type AdminClient = ReturnType<typeof createAdminClient>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decryptFields(r: any): RegistrationFields {
  return {
    name: safeDecrypt(r.encrypted_name),
    phone: safeDecrypt(r.encrypted_phone),
    address: safeDecrypt(r.encrypted_address),
    birthDate: safeDecrypt(r.encrypted_birth_date),
    gender: r.gender,
    agama: r.agama ?? '',
    pekerjaan: r.pekerjaan ?? '',
    hobi: r.hobi ?? '',
    keluhan: r.keluhan ?? '',
    kelurahan: r.kelurahan ?? '',
    kecamatan: r.kecamatan ?? '',
    kabupatenKota: r.kabupaten_kota ?? '',
    provinsi: r.provinsi ?? '',
    namaPanggilan: r.nama_panggilan ?? '',
    namaIbu: r.nama_ibu ?? '',
    pekerjaanIbu: r.pekerjaan_ibu ?? '',
    namaAyah: r.nama_ayah ?? '',
    pekerjaanAyah: r.pekerjaan_ayah ?? '',
    sumber: r.sumber ?? '',
  }
}

export async function fetchRegistrationsPage(params: {
  status: RegistrationStatus | 'all'
  type: RegistrationType | 'all'
  branchId: string
  search: string
  page: number
}): Promise<{
  error: string | null
  rows: RegistrationRow[]
  total: number
  stats: RegistrationStats
  isDirector: boolean
  branches: { id: string; name: string }[]
}> {
  const empty = { rows: [], total: 0, stats: { total: 0, pending: 0, approved: 0, rejected: 0 }, isDirector: false, branches: [] }
  const reviewer = await getReviewer()
  if (!reviewer) return { ...empty, error: 'Tidak memiliki akses.' }

  const admin = createAdminClient()
  const isDirector = reviewer.role === 'director'
  const branchFilter = isDirector ? (params.branchId === 'all' ? null : params.branchId) : reviewer.branchId
  if (!isDirector && !branchFilter) return { ...empty, error: 'Akun Anda belum terhubung ke cabang.' }

  const countFor = async (status?: RegistrationStatus) => {
    let q = admin.from('patient_registrations').select('id', { count: 'exact', head: true })
    if (branchFilter) q = q.eq('branch_id', branchFilter)
    if (params.type !== 'all') q = q.eq('registration_type', params.type)
    if (status) q = q.eq('status', status)
    const { count } = await q
    return count ?? 0
  }

  let query = admin
    .from('patient_registrations')
    .select(
      '*, branches!branch_id(name), internal_profiles!reviewed_by(full_name)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
  if (branchFilter) query = query.eq('branch_id', branchFilter)
  if (params.type !== 'all') query = query.eq('registration_type', params.type)
  if (params.status !== 'all') query = query.eq('status', params.status)

  // Name/phone are encrypted, so a search decrypts the (small) filtered set and
  // paginates in memory; without a search, paginate in the DB.
  const term = params.search.trim().toLowerCase()
  const from = (params.page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  if (!term) query = query.range(from, to)
  else query = query.limit(1000)

  const [{ data, count, error }, total, pending, approved, rejected, branchRes] = await Promise.all([
    query,
    countFor(),
    countFor('pending'),
    countFor('approved'),
    countFor('rejected'),
    isDirector
      ? admin.from('branches').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])
  if (error) return { ...empty, isDirector, error: error.message }

  let rows: RegistrationRow[] = (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    branchId: r.branch_id,
    branchName: r.branches?.name ?? null,
    status: r.status,
    rejectionNote: r.rejection_note,
    reviewedAt: r.reviewed_at,
    reviewerName: r.internal_profiles?.full_name ?? null,
    patientId: r.patient_id,
    type: r.registration_type === 'griya' ? 'griya' : 'umum',
    isGriya: r.registration_type === 'griya',
    duplicatePatientId: null,
    affiliateCode: r.affiliate_code ?? null,
    ...decryptFields(r),
  }))

  let filteredTotal = count ?? 0
  if (term) {
    rows = rows.filter((r) =>
      r.name.toLowerCase().includes(term) ||
      r.phone.includes(term) ||
      r.namaPanggilan.toLowerCase().includes(term) ||
      r.namaIbu.toLowerCase().includes(term) ||
      r.namaAyah.toLowerCase().includes(term) ||
      r.keluhan.toLowerCase().includes(term),
    )
    filteredTotal = rows.length
    rows = rows.slice(from, to + 1)
  }

  // Flag pending registrations whose phone already belongs to a patient.
  const pendingRows = rows.filter((r) => r.status === 'pending' && r.phone)
  if (pendingRows.length > 0) {
    const hashes = pendingRows.map((r) => hashPhone(r.phone))
    const { data: matches } = await admin
      .from('patients')
      .select('id, phone_hash')
      .in('phone_hash', hashes)
    const byHash = new Map((matches ?? []).map((m) => [m.phone_hash, m.id]))
    for (const r of pendingRows) r.duplicatePatientId = byHash.get(hashPhone(r.phone)) ?? null
  }

  return {
    error: null,
    rows,
    total: filteredTotal,
    stats: { total, pending, approved, rejected },
    isDirector,
    branches: branchRes.data ?? [],
  }
}

function encryptedColumns(f: RegistrationFields) {
  return {
    encrypted_name:       encrypt(f.name.trim()),
    encrypted_phone:      encrypt(f.phone.trim()),
    encrypted_address:    nz(f.address) ? encrypt(f.address.trim()) : null,
    encrypted_birth_date: nz(f.birthDate) ? encrypt(f.birthDate) : null,
    gender:               f.gender,
    agama:                nz(f.agama),
    pekerjaan:            nz(f.pekerjaan),
    hobi:                 nz(f.hobi),
    keluhan:              nz(f.keluhan),
    kelurahan:            nz(f.kelurahan),
    kecamatan:            nz(f.kecamatan),
    kabupaten_kota:       nz(f.kabupatenKota),
    provinsi:             nz(f.provinsi),
    nama_panggilan:       nz(f.namaPanggilan),
    nama_ibu:             nz(f.namaIbu),
    pekerjaan_ibu:        nz(f.pekerjaanIbu),
    nama_ayah:            nz(f.namaAyah),
    pekerjaan_ayah:       nz(f.pekerjaanAyah),
    sumber:               normalizeSumber(f.sumber),
  }
}

export async function updateRegistration(
  id: string,
  fields: RegistrationFields,
): Promise<{ error: string | null }> {
  const reviewer = await getReviewer()
  if (!reviewer) return { error: 'Tidak memiliki akses.' }
  const reg = await getScopedRegistration(reviewer, id)
  if (!reg) return { error: 'Pendaftaran tidak ditemukan.' }
  if (reg.status !== 'pending') return { error: 'Pendaftaran sudah diproses.' }
  if (!fields.name.trim() || !fields.phone.trim()) return { error: 'Nama dan No. HP wajib diisi.' }

  const { error } = await createAdminClient()
    .from('patient_registrations')
    .update(encryptedColumns(fields))
    .eq('id', id)
    .eq('status', 'pending')
  return { error: error?.message ?? null }
}

type ScopedRegistration = NonNullable<Awaited<ReturnType<typeof getScopedRegistration>>>

/**
 * Creates the patient for one pending registration. Shared by single and bulk
 * approval. Griya Anak registrations also get a griya_students roster row so the
 * child shows up in /griya-anak/siswa and the Griya jadwal search.
 */
async function approveOne(
  admin: AdminClient,
  reviewer: Reviewer,
  reg: ScopedRegistration,
  fields: RegistrationFields & { no_rm?: string },
): Promise<{ error: string | null; patientId: string | null }> {
  const isGriya = reg.registration_type === 'griya'
  if (reg.status !== 'pending') return { error: 'Pendaftaran sudah diproses.', patientId: null }
  if (!fields.name.trim() || !fields.phone.trim() || !fields.gender) {
    return { error: 'Nama, No. HP, dan jenis kelamin wajib diisi.', patientId: null }
  }
  if (isGriya && (!fields.namaIbu.trim() || !fields.namaAyah.trim())) {
    return { error: 'Nama ibu dan nama ayah wajib diisi.', patientId: null }
  }

  // Claim the registration first so two reviewers can't both create a patient.
  const { data: claimed } = await admin
    .from('patient_registrations')
    .update({ ...encryptedColumns(fields), status: 'approved', reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() })
    .eq('id', reg.id)
    .eq('status', 'pending')
    .select('id')
  if (!claimed || claimed.length === 0) return { error: 'Pendaftaran sudah diproses.', patientId: null }

  const release = () => admin
    .from('patient_registrations')
    .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
    .eq('id', reg.id)

  const enc = encryptPatientPII({
    name:      fields.name.trim(),
    phone:     fields.phone.trim(),
    address:   nz(fields.address) ?? undefined,
    birthDate: nz(fields.birthDate) ?? undefined,
  })
  const { data: patient, error } = await admin.from('patients').insert({
    encrypted_name:       enc.encrypted_name,
    encrypted_phone:      enc.encrypted_phone,
    encrypted_address:    enc.encrypted_address    ?? null,
    encrypted_birth_date: enc.encrypted_birth_date ?? null,
    gender:               fields.gender,
    phone_hash:           await phoneHashIfFree(fields.phone.trim()),
    name_normalized:      fields.name.trim().toLowerCase(),
    no_rm:                nz(fields.no_rm),
    pekerjaan:            nz(fields.pekerjaan),
    agama:                nz(fields.agama),
    hobi:                 nz(fields.hobi),
    kelurahan:            nz(fields.kelurahan),
    kecamatan:            nz(fields.kecamatan),
    kabupaten_kota:       nz(fields.kabupatenKota),
    provinsi:             nz(fields.provinsi),
    keluhan:              nz(fields.keluhan),
    ...(isGriya && {
      nama_panggilan:     nz(fields.namaPanggilan),
      nama_ibu:           nz(fields.namaIbu),
      pekerjaan_ibu:      nz(fields.pekerjaanIbu),
      nama_ayah:          nz(fields.namaAyah),
      pekerjaan_ayah:     nz(fields.pekerjaanAyah),
      sumber:             normalizeSumber(fields.sumber),
    }),
  }).select('id').single()

  if (error || !patient) {
    // Release the claim so the registration can be fixed and approved again.
    await release()
    const msg = error?.code === '23505' && error.message.includes('no_rm')
      ? `No. RM "${nz(fields.no_rm)}" sudah dipakai pasien lain.`
      : (error?.message ?? 'Gagal membuat pasien.')
    return { error: msg, patientId: null }
  }

  if (isGriya) {
    const { error: enrollErr } = await admin.from('griya_students').upsert(
      { patient_id: patient.id, branch_id: reg.branch_id, source: 'online-registration', created_by: reviewer.id },
      { onConflict: 'patient_id' },
    )
    if (enrollErr) {
      // Don't leave a patient that isn't on the Griya roster — undo and let them retry.
      await admin.from('patients').delete().eq('id', patient.id)
      await release()
      return { error: `Gagal mendaftarkan ke Griya Anak: ${enrollErr.message}`, patientId: null }
    }
  }

  await admin.from('patient_registrations').update({ patient_id: patient.id }).eq('id', reg.id)

  const supabase = await createClient()
  await logActivity({
    supabase, userId: reviewer.id, action: 'create', resourceType: 'patient',
    resourceId: patient.id, resourceLabel: fields.name.trim(), branchId: reg.branch_id,
    newValues: { source: 'patient_registration', registration_id: reg.id, no_rm: nz(fields.no_rm), griya_anak: isGriya },
  })

  return { error: null, patientId: patient.id }
}

export async function approveRegistration(
  id: string,
  fields: RegistrationFields & { no_rm?: string },
): Promise<{ error: string | null; patientId: string | null }> {
  const reviewer = await getReviewer()
  if (!reviewer) return { error: 'Tidak memiliki akses.', patientId: null }
  const reg = await getScopedRegistration(reviewer, id)
  if (!reg) return { error: 'Pendaftaran tidak ditemukan.', patientId: null }
  return approveOne(createAdminClient(), reviewer, reg, fields)
}

/** Approves each selected pending registration as submitted (no edits, no No. RM). */
export async function bulkApproveRegistrations(ids: string[]): Promise<{
  error: string | null
  approved: number
  failed: { name: string; error: string }[]
}> {
  const reviewer = await getReviewer()
  if (!reviewer) return { error: 'Tidak memiliki akses.', approved: 0, failed: [] }
  if (ids.length === 0) return { error: null, approved: 0, failed: [] }

  const admin = createAdminClient()
  let q = admin.from('patient_registrations').select('*').in('id', ids).eq('status', 'pending')
  if (reviewer.role !== 'director') q = q.eq('branch_id', reviewer.branchId)
  const { data, error } = await q
  if (error) return { error: error.message, approved: 0, failed: [] }

  let approved = 0
  const failed: { name: string; error: string }[] = []
  // Sequential: each approval claims its row and checks phone_hash uniqueness.
  for (const r of data ?? []) {
    const fields = decryptFields(r)
    const res = await approveOne(admin, reviewer, r, fields)
    if (res.error) failed.push({ name: fields.name || '—', error: res.error })
    else approved++
  }
  return { error: null, approved, failed }
}

/** Removes registrations from the queue. Patients already created are kept. */
export async function deleteRegistrations(ids: string[]): Promise<{ error: string | null; deleted: number }> {
  const reviewer = await getReviewer()
  if (!reviewer) return { error: 'Tidak memiliki akses.', deleted: 0 }
  if (ids.length === 0) return { error: null, deleted: 0 }

  let q = createAdminClient().from('patient_registrations').delete().in('id', ids)
  if (reviewer.role !== 'director') q = q.eq('branch_id', reviewer.branchId)
  const { data, error } = await q.select('id, branch_id, status')
  if (error) return { error: error.message, deleted: 0 }

  const supabase = await createClient()
  for (const r of data ?? []) {
    await logActivity({
      supabase, userId: reviewer.id, action: 'delete', resourceType: 'patient_registration',
      resourceId: r.id, branchId: r.branch_id, oldValues: { status: r.status },
    })
  }
  return { error: null, deleted: data?.length ?? 0 }
}

export async function rejectRegistration(
  id: string,
  note: string,
): Promise<{ error: string | null }> {
  const reviewer = await getReviewer()
  if (!reviewer) return { error: 'Tidak memiliki akses.' }
  const reg = await getScopedRegistration(reviewer, id)
  if (!reg) return { error: 'Pendaftaran tidak ditemukan.' }
  if (!note.trim()) return { error: 'Alasan penolakan wajib diisi.' }

  const { data, error } = await createAdminClient()
    .from('patient_registrations')
    .update({ status: 'rejected', rejection_note: note.trim(), reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Pendaftaran sudah diproses.' }

  const supabase = await createClient()
  await logActivity({
    supabase, userId: reviewer.id, action: 'update', resourceType: 'patient_registration',
    resourceId: id, branchId: reg.branch_id,
    newValues: { status: 'rejected', rejection_note: note.trim() },
  })
  return { error: null }
}
