import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivityAction = 'create' | 'update' | 'delete'

export const ACTIVITY_RESOURCE_TYPES = {
  patient: 'Pasien',
  patient_visit: 'Kunjungan Pasien',
  transaction: 'Transaksi',
  leave_request: 'Pengajuan Cuti',
  staff_target: 'Target Staff',
  attendance: 'Absensi',
  internal_profile: 'Staff / Pengguna',
  branch_financial_report: 'Laporan Keuangan Cabang',
  campaign: 'Kampanye',
  branch: 'Cabang',
  role_page_permission: 'Akses Halaman',
  griya_slot: 'Jadwal Griya Anak',
  griya_product: 'Produk Toko Griya Anak',
  griya_sale: 'Penjualan Toko Griya Anak',
  patient_registration: 'Pendaftaran Pasien',
  patient_package: 'Paket Pasien',
  payroll_period: 'Periode Penggajian',
  payroll_activity: 'Aktivitas Insentif',
  payroll_adjustment: 'Penyesuaian Gaji',
  payroll_employee: 'Data Karyawan (Gaji)',
  payroll_compensation: 'Kompensasi Karyawan',
  payroll_setting: 'Pengaturan Penggajian',
  pfotm_period: 'Periode PFOTM',
  pfotm_entry: 'Data Performa PFOTM',
  pfotm_rule: 'Aturan Poin PFOTM',
} as const

export type ActivityResourceType = keyof typeof ACTIVITY_RESOURCE_TYPES

interface LogActivityInput {
  supabase: SupabaseClient
  userId: string | null | undefined
  action: ActivityAction
  resourceType: ActivityResourceType
  resourceId?: string | number | null
  resourceLabel?: string | null
  branchId?: string | null
  /** Patient this activity concerns. Resolved automatically when omitted. */
  patientId?: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}

// Tables whose rows carry a patient_id, keyed by the resource type logged for them.
const PATIENT_LINKED_TABLES: Partial<Record<ActivityResourceType, string>> = {
  patient_visit: 'patient_visits',
  transaction: 'transactions',
  griya_slot: 'griya_schedule_slots',
  patient_package: 'patient_packages',
}

/**
 * Finds the patient an activity concerns so the log can be filtered per
 * patient. Falls back to looking the resource row up — that can't work for a
 * deleted row, so delete call sites must pass patientId themselves.
 */
async function resolvePatientId(input: LogActivityInput): Promise<string | null> {
  const { supabase, patientId, resourceType, resourceId, oldValues, newValues } = input
  if (patientId) return patientId
  if (resourceType === 'patient') return resourceId != null ? String(resourceId) : null

  const fromValues = newValues?.patient_id ?? oldValues?.patient_id
  if (typeof fromValues === 'string' && fromValues) return fromValues

  const table = PATIENT_LINKED_TABLES[resourceType]
  if (!table || resourceId == null) return null
  const { data } = await supabase.from(table).select('patient_id').eq('id', String(resourceId)).maybeSingle()
  return (data?.patient_id as string | null) ?? null
}

/**
 * Logs an activity_logs row for a mutation. Never throws — a logging
 * failure must never block the real mutation it's describing. Works with
 * either the browser or server Supabase client (both return the same
 * SupabaseClient shape).
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const {
      supabase, userId, action, resourceType, resourceId, resourceLabel,
      branchId, oldValues, newValues,
    } = input
    if (!userId) return

    const { data: actor } = await supabase
      .from('internal_profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single()

    let changedFields: string[] | null = null
    let storedOld: Record<string, unknown> | null = oldValues ?? null
    let storedNew: Record<string, unknown> | null = newValues ?? null

    if (action === 'update' && oldValues && newValues) {
      changedFields = Object.keys(newValues).filter(
        (k) => JSON.stringify(oldValues[k]) !== JSON.stringify(newValues[k])
      )
      if (changedFields.length === 0) return
      storedOld = Object.fromEntries(changedFields.map((k) => [k, oldValues[k]]))
      storedNew = Object.fromEntries(changedFields.map((k) => [k, newValues[k]]))
    }

    await supabase.from('activity_logs').insert({
      user_id: userId,
      actor_name: actor?.full_name ?? null,
      actor_email: actor?.email ?? null,
      action,
      resource_type: resourceType,
      resource_id: resourceId != null ? String(resourceId) : null,
      resource_label: resourceLabel ?? null,
      branch_id: branchId ?? null,
      patient_id: await resolvePatientId(input),
      changed_fields: changedFields,
      old_values: storedOld,
      new_values: storedNew,
    })
  } catch (err) {
    console.error('[logActivity] failed:', err)
  }
}
