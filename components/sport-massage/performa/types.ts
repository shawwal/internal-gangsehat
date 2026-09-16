export interface TherapistPerforma {
  therapist_id: string
  name: string
  nickname: string | null
  avatar_url: string | null
  total: number
}

export interface DateRangeState {
  from: string // yyyy-mm-dd, inclusive
  to: string   // yyyy-mm-dd, inclusive
}
