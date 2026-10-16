import { describe, expect, it } from 'vitest'
import { pickLastTherapistVisit, type VisitForSuggest } from './suggestTherapist'

const v = (over: Partial<VisitForSuggest>): VisitForSuggest => ({
  id: Math.random().toString(36), patient_id: 'p1', branch_id: 'b1', visit_date: '2026-10-05',
  attending_staff_id: 'hesti', status: 'completed', kehadiran: 'HADIR', ...over,
})
const item = { key: 't1', patient_id: 'p1', branch_id: 'b1', date: '2026-10-10' }
const TODAY = '2026-10-16'

describe('pickLastTherapistVisit', () => {
  it('picks the latest attended visit on or before the date', () => {
    const visits = [
      v({ visit_date: '2026-10-01', attending_staff_id: 'okta' }),
      v({ visit_date: '2026-10-10', attending_staff_id: 'prity' }),   // same day counts
      v({ visit_date: '2026-10-12', attending_staff_id: 'aul' }),     // after the sale
    ]
    expect(pickLastTherapistVisit(visits, item, TODAY)?.attending_staff_id).toBe('prity')
  })

  it('ignores absent, cancelled, other-branch, other-patient and unstaffed visits', () => {
    const visits = [
      v({ visit_date: '2026-10-02', attending_staff_id: 'okta' }),
      v({ visit_date: '2026-10-08', kehadiran: 'TIDAK HADIR', attending_staff_id: 'x1' }),
      v({ visit_date: '2026-10-08', status: 'cancelled', attending_staff_id: 'x2' }),
      v({ visit_date: '2026-10-08', branch_id: 'b2', attending_staff_id: 'x3' }),
      v({ visit_date: '2026-10-08', patient_id: 'p2', attending_staff_id: 'x4' }),
      v({ visit_date: '2026-10-08', attending_staff_id: null }),
    ]
    expect(pickLastTherapistVisit(visits, item, TODAY)?.attending_staff_id).toBe('okta')
  })

  it('counts an unmarked visit only once its date has passed, and never suggests the visit itself', () => {
    const self = v({ id: 'self', visit_date: '2026-10-09', attending_staff_id: 'self' })
    const visits = [self, v({ visit_date: '2026-10-03', kehadiran: null, attending_staff_id: 'hena' })]
    expect(pickLastTherapistVisit(visits, { ...item, excludeVisitId: 'self' }, TODAY)?.attending_staff_id).toBe('hena')
    expect(pickLastTherapistVisit([v({ kehadiran: null, visit_date: '2026-10-10' })], item, '2026-10-10')).toBeNull()
  })

  it('returns null with no earlier visit', () => {
    expect(pickLastTherapistVisit([v({ visit_date: '2026-10-11' })], item, TODAY)).toBeNull()
  })
})
