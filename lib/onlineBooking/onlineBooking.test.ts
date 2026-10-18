import { describe, expect, it } from 'vitest'
import { signPublicRequest, verifyPublicRequest } from './auth'
import { branchHours, computeAvailability, minutesUntil, FALLBACK_HOURS } from './availability'
import { buildScheduledStaff, isInShift, type OverrideRow, type ScheduleRow } from '@/lib/jadwal/dayStaff'

const SECRET = 'test-secret'

describe('public API signature', () => {
  const body = JSON.stringify({ action: 'options' })
  const now = 1_800_000_000
  const ts = String(now)

  it('accepts a valid signature', () => {
    expect(verifyPublicRequest(SECRET, ts, signPublicRequest(SECRET, ts, body), body, now)).toBe(true)
  })
  it('rejects a tampered body', () => {
    expect(verifyPublicRequest(SECRET, ts, signPublicRequest(SECRET, ts, body), body + ' ', now)).toBe(false)
  })
  it('rejects a stale timestamp', () => {
    expect(verifyPublicRequest(SECRET, ts, signPublicRequest(SECRET, ts, body), body, now + 301)).toBe(false)
  })
  it('rejects when the secret is not configured or headers are missing', () => {
    const sig = signPublicRequest(SECRET, ts, body)
    expect(verifyPublicRequest(undefined, ts, sig, body, now)).toBe(false)
    expect(verifyPublicRequest(SECRET, null, sig, body, now)).toBe(false)
    expect(verifyPublicRequest(SECRET, ts, null, body, now)).toBe(false)
    expect(verifyPublicRequest(SECRET, ts, 'zz', body, now)).toBe(false)
  })
})

const therapist = (id: string, branch: string, extra: Partial<ScheduleRow> = {}): ScheduleRow => ({
  staff_id: id,
  branch_id: branch,
  shift: 'PAGI',
  jam_mulai: '08:00:00',
  jam_selesai: '14:00:00',
  internal_profiles: { full_name: id.toUpperCase(), role: 'therapist', branch_id: branch },
  ...extra,
})

describe('buildScheduledStaff', () => {
  it('counts a regular schedule at the staff home branch only', () => {
    const { entries } = buildScheduledStaff({
      hari: 'SENIN', branchId: 'B1',
      schedules: [therapist('a', 'B1'), therapist('b', 'B2')],
      overrides: [], leaves: [],
    })
    expect([...entries.keys()]).toEqual(['a'])
  })

  it('applies an override for today and suppresses staff moved elsewhere', () => {
    const moved: OverrideRow = { ...therapist('b', 'B2'), id: 'o1', hari: 'SELASA' }
    const covering: OverrideRow = { ...therapist('c', 'B1', { jam_mulai: '15:00', jam_selesai: '19:00' }), id: 'o2', hari: 'SENIN' }
    const { entries } = buildScheduledStaff({
      hari: 'SENIN', branchId: 'B2',
      schedules: [therapist('b', 'B2')],
      overrides: [moved, { ...covering, branch_id: 'B2' }],
      leaves: [],
    })
    expect(entries.has('b')).toBe(false)
    expect(entries.get('c')?.jam_mulai).toBe('15:00')
    expect(entries.get('c')?.isOverride).toBe(true)
  })

  it('hides directors and marks approved leave', () => {
    const { entries } = buildScheduledStaff({
      hari: 'SENIN', branchId: null,
      schedules: [
        therapist('a', 'B1'),
        therapist('d', 'B1', { internal_profiles: { full_name: 'D', role: 'director', branch_id: 'B1' } }),
      ],
      overrides: [],
      leaves: [{ id: 'l1', staff_id: 'a', reason: 'sakit', status: 'approved', start_date: '2026-10-19', end_date: '2026-10-19' }],
    })
    expect(entries.has('d')).toBe(false)
    const a = entries.get('a')!
    expect(a.isOnLeave).toBe(true)
    expect(isInShift(a, 9)).toBe(false)
  })
})

describe('availability', () => {
  const { entries } = buildScheduledStaff({
    hari: 'SENIN', branchId: 'B1',
    schedules: [therapist('a', 'B1'), therapist('b', 'B1', { jam_mulai: '10:00', jam_selesai: '12:00' })],
    overrides: [], leaves: [],
  })
  const staff = [...entries.values()]
  // 2026-10-19 00:00 Jakarta
  const now = new Date(Date.UTC(2026, 9, 18, 17, 0, 0))

  it('uses branch slots, falling back to the grid default hours', () => {
    expect(branchHours([]).map((h) => h.hour)).toEqual(FALLBACK_HOURS)
    expect(branchHours([{ shift: 'PAGI', slot_time: '09:00' }, { shift: 'SORE', slot_time: '15:30' }]))
      .toEqual([{ hour: 9, shift: 'PAGI' }, { hour: 15, shift: 'SORE' }])
  })

  it('computes minutes until a slot in Jakarta time', () => {
    expect(minutesUntil('2026-10-19', 9, now)).toBe(9 * 60)
  })

  it('lists free therapists per hour, minus busy ones and shift edges', () => {
    const hours = computeAvailability({
      date: '2026-10-19',
      staff,
      slots: [9, 10, 11, 13, 14].map((h) => ({ shift: 'PAGI', slot_time: `${h}:00` })),
      busy: [{ staff_id: 'a', hour: 10 }],
      now,
    })
    expect(hours.map((h) => [h.hour, h.therapists.map((t) => t.id)])).toEqual([
      [9, ['a']],
      [10, ['b']],
      [11, ['a', 'b']],
      [13, ['a']],
    ])
  })

  it('drops hours inside the minimum lead time', () => {
    const hours = computeAvailability({
      date: '2026-10-19',
      staff,
      slots: [{ shift: 'PAGI', slot_time: '09:00' }, { shift: 'PAGI', slot_time: '11:00' }],
      busy: [],
      now: new Date(Date.UTC(2026, 9, 19, 1, 30, 0)), // 08:30 Jakarta
    })
    expect(hours.map((h) => h.hour)).toEqual([11])
  })
})

describe('onlineServiceTypeFor', async () => {
  const { onlineServiceTypeFor } = await import('./service')
  const row = (nama: string, kategori: string, harga: number, online: string | null = null) =>
    ({ id: nama, nama, kategori, harga, branch_id: 'B1', online_service_type: online })

  it('falls back to clinic prices when the branch has nothing configured', () => {
    expect(onlineServiceTypeFor(row('Terapi Awal', 'TA KLINIK', 250000), false)).toBe('TERAPI AWAL')
    expect(onlineServiceTypeFor(row('Sesi Terapi', 'SESI KLINIK', 180000), false)).toBe('SESI TERAPI')
    expect(onlineServiceTypeFor(row('Sport Massage', 'SESI KLINIK', 150000), false)).toBeNull()
    expect(onlineServiceTypeFor(row('Paket Penyesuaian', 'SESI KLINIK', 0), false)).toBeNull()
    expect(onlineServiceTypeFor(row('Paket 1', 'PAKET KLINIK', 650000), false)).toBeNull()
    expect(onlineServiceTypeFor(row('Home Visit', 'TA VISIT', 300000), false)).toBeNull()
  })

  it('uses only the director setting once the branch has one', () => {
    expect(onlineServiceTypeFor(row('Sesi', 'SESI KLINIK', 150000), true)).toBeNull()
    expect(onlineServiceTypeFor(row('Sesi Terapi', 'SESI KLINIK', 180000, 'SESI TERAPI'), true)).toBe('SESI TERAPI')
  })
})
