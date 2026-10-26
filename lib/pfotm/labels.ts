// Column names for the PFOTM sales / referral metrics, as the manager named them
// ("Issue Singkatan"). The board itself reads `pfotm_point_rules.metric_label`
// (migration 117 sets the same names); these are for places that show a metric
// without a rule row: the Tarif Layanan tag picker, history, help text.
export const PFOTM_METRIC_LABELS = {
  paket_1: 'Paket 5 sessions',
  paket_2: 'Paket 10 sessions',
  paket_3: 'Paket 20 sessions',
  ta_sesi_visit: 'Terapi Awal dan Sesi Terapi Visit',
  paket_visit: 'Paket Visit',
  rujukan_sm: 'Rujukan Sports Massage',
} as const

export type PfotmLabeledMetric = keyof typeof PFOTM_METRIC_LABELS
