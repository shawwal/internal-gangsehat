import type { GriyaTerapiAwal } from '@/types'
import type { GriyaRmType } from '@/lib/griyaVisitRouting'

// Single source of truth for the Griya Anak Terapi Awal forms: the intake page
// renders these, the rekam medis list shows them, and the PDF prints them.

export type RmFieldKey = Exclude<keyof GriyaTerapiAwal,
  'id' | 'visit_id' | 'patient_id' | 'branch_id' | 'status' | 'created_by' | 'created_at' | 'updated_at' | 'rm_type'
  | 'assessor_si_id' | 'assessor_si_tanggal' | 'assessor_wicara_id' | 'assessor_wicara_tanggal'>

export type RmFieldDef = {
  k: RmFieldKey
  label: string
  /** text (default) · textarea (full width) · program (checkbox + optional note) · choice (pill options) */
  kind?: 'text' | 'textarea' | 'program' | 'choice'
  options?: { value: string; label: string }[]
  required?: boolean
  full?: boolean
}

export type RmSectionDef = {
  title: string
  subtitle?: string
  /** consecutive `half` sections sit side by side on large screens */
  half?: boolean
  fields: RmFieldDef[]
}

// Program checkbox: checked = non-empty value; a plain check is stored as 'Ya',
// any other text is a note.
export const PROGRAM_CHECKED = 'Ya'

const MILESTONES: RmFieldDef[] = [
  { k: 'usia_angkat_kepala', label: 'Kemampuan angkat kepala (usia … bulan)' },
  { k: 'usia_merayap', label: 'Kemampuan merayap (usia … bulan)' },
  { k: 'usia_merangkak', label: 'Kemampuan merangkak (usia … bulan)' },
  { k: 'usia_duduk_mandiri', label: 'Kemampuan duduk mandiri (usia … bulan)' },
  { k: 'usia_merambat', label: 'Kemampuan merambat (usia … bulan)' },
  { k: 'usia_berjalan', label: 'Kemampuan berjalan (usia … bulan)' },
  { k: 'usia_menunjuk', label: 'Kemampuan menunjuk (usia … bulan)' },
  { k: 'usia_babbling', label: 'Kemampuan babbling (usia … bulan)' },
  { k: 'usia_mengucap_kata', label: 'Kemampuan mengucapkan kata (usia … bulan)' },
  { k: 'toilet_training', label: 'Toilet training' },
  { k: 'pertumbuhan_lainnya', label: 'Dan lain-lain', kind: 'textarea' },
]

const ORAL_MOTOR: RmFieldDef[] = [
  { k: 'kemampuan_menyedot', label: 'Kemampuan menyedot (direct breastfeeding/dot)' },
  { k: 'kemampuan_sikat_gigi', label: 'Kemampuan sikat gigi (mau/tidak)' },
  { k: 'kemampuan_menghisap_pipet', label: 'Kemampuan menghisap pipet (bisa/tidak)' },
  { k: 'kemampuan_meniup_lilin', label: 'Kemampuan meniup lilin (bisa/tidak)' },
  { k: 'kemampuan_kontrol_liur', label: 'Kemampuan kontrol liur (bisa/tidak)' },
  { k: 'kemampuan_mengunyah', label: 'Kemampuan mengunyah (mengunyah/mengulum)' },
  { k: 'kemampuan_makan', label: 'Kemampuan makan (tersedak/batuk/baik saja)' },
  { k: 'bentuk_tekstur_makanan', label: 'Bentuk tekstur makanan (halus-bayi/kasar-dewasa)' },
  { k: 'wicara_lainnya', label: 'Dan lain-lain', kind: 'textarea' },
]

const JADWAL = (required = false): RmSectionDef => ({
  title: 'Jadwal Terapi',
  subtitle: 'Menyesuaikan orang tua dan jadwal kosong praktik',
  fields: [
    { k: 'jadwal_hari', label: 'Hari', required },
    { k: 'jadwal_pukul', label: 'Pukul', required },
  ],
})

const DEFAULT_SECTIONS: RmSectionDef[] = [
  { title: 'Keluhan Utama', half: true, fields: [{ k: 'keluhan_utama', label: 'Keluhan utama', kind: 'textarea' }] },
  { title: 'Riwayat Keluarga', half: true, fields: [{ k: 'riwayat_keluarga', label: 'Keluarga dengan keluhan yang sama (Paman/Bibi/Keponakan)', kind: 'textarea' }] },
  {
    title: 'Masa Pertumbuhan dan Perkembangan',
    fields: [
      { k: 'berat_badan', label: 'Berat badan' },
      { k: 'tinggi_badan', label: 'Tinggi badan' },
      { k: 'lingkar_kepala', label: 'Lingkar kepala' },
      ...MILESTONES,
    ],
  },
  { title: 'Riwayat Sakit / Keluhan', subtitle: 'Rawat inap / rawat jalan / konsultasi / terapi', fields: [{ k: 'riwayat_sakit', label: 'Riwayat', kind: 'textarea' }] },
  { title: 'Masalah Wicara / Oral Motor', fields: ORAL_MOTOR },
  {
    title: 'Pemeriksaan Objektif/Penunjang', half: true,
    fields: [{ k: 'kontak_mata', label: 'Kontak mata' }, { k: 'kemampuan_duduk_tenang', label: 'Kemampuan duduk tenang' }],
  },
  { title: 'Diagnosa (dari Assessor)', half: true, fields: [{ k: 'diagnosa', label: 'Diagnosa', kind: 'textarea', required: true }] },
  {
    title: 'Program Rencana Terapi', subtitle: 'Centang program yang direkomendasikan',
    fields: [
      { k: 'fisioterapi_motorik', label: 'Fisioterapi Motorik', kind: 'program' },
      { k: 'fisioterapi_sensorik', label: 'Fisioterapi Sensorik / Sensori Integrasi', kind: 'program' },
      { k: 'terapi_wicara', label: 'Terapi Wicara', kind: 'program' },
      { k: 'terapi_okupasi', label: 'Terapi Okupasi', kind: 'program' },
      { k: 'terapi_perilaku', label: 'Terapi Perilaku', kind: 'program' },
    ],
  },
  { title: 'Target & Program Terapi', fields: [{ k: 'target_program_terapi', label: 'Target & Program', kind: 'textarea' }] },
  JADWAL(),
]

const FISIOTERAPI_SECTIONS: RmSectionDef[] = [
  { title: 'Keluhan Utama', half: true, fields: [{ k: 'keluhan_utama', label: 'Keluhan utama', kind: 'textarea' }] },
  { title: 'Riwayat Keluarga', subtitle: 'Keluarga dengan keluhan serupa; Paman/Bibi/Keponakan', half: true, fields: [{ k: 'riwayat_keluarga', label: 'Riwayat keluarga', kind: 'textarea' }] },
  {
    title: 'Riwayat Kehamilan', subtitle: 'Yang dirasakan selama masa kehamilan',
    fields: [
      { k: 'usia_ibu_hamil', label: 'Usia saat hamil' },
      { k: 'problem_kehamilan', label: 'Problem kehamilan' },
      { k: 'jumlah_hamil', label: 'Hamil yang keberapa' },
      { k: 'obat_kehamilan', label: 'Obat yang dikonsumsi' },
      { k: 'penyakit_ibu', label: 'Riwayat penyakit ibu' },
      { k: 'vitamin_kehamilan', label: 'Vitamin yang dikonsumsi' },
      { k: 'aktivitas_ibu_hamil', label: 'Aktivitas ibu selama hamil', kind: 'textarea' },
    ],
  },
  {
    title: 'Riwayat Kelahiran',
    fields: [
      { k: 'langsung_menangis', label: 'Bayi langsung menangis' },
      { k: 'tempat_lahir', label: 'Tempat lahiran' },
      { k: 'jumlah_melahirkan', label: 'Berapa kali melahirkan' },
      { k: 'induksi', label: 'Induksi' },
      { k: 'cara_lahir', label: 'Cesar/Normal', kind: 'choice', options: [{ value: 'CESAR', label: 'Cesar' }, { value: 'NORMAL', label: 'Normal' }] },
      { k: 'nicu', label: 'NICU' },
      { k: 'inkubator', label: 'Inkubator' },
      { k: 'berat_badan_lahir', label: 'Berat badan lahir' },
      { k: 'panjang_badan_lahir', label: 'Panjang badan lahir' },
      { k: 'kondisi_khusus_lahir', label: 'Kelainan fisik habis lahir' },
      { k: 'kelahiran_lainnya', label: 'Dan lain-lain', kind: 'textarea' },
    ],
  },
  {
    title: 'Indeks IMT', subtitle: 'Saat ini vs standar', half: true,
    fields: [
      { k: 'berat_badan', label: 'Berat badan — saat ini' },
      { k: 'bb_standar', label: 'Berat badan — standar' },
      { k: 'tinggi_badan', label: 'Panjang/Tinggi — saat ini' },
      { k: 'tb_standar', label: 'Panjang/Tinggi — standar' },
      { k: 'lingkar_kepala', label: 'Lingkar kepala — saat ini' },
      { k: 'lk_standar', label: 'Lingkar kepala — standar' },
    ],
  },
  {
    title: 'Regulasi Reflek Anak', half: true,
    fields: [
      { k: 'reflek_rooting', label: 'Rooting reflex (4 bulan)' },
      { k: 'reflek_moro', label: 'Moro reflex (2 bulan)' },
      { k: 'reflek_sucking', label: 'Sucking reflex' },
      { k: 'reflek_atnr', label: 'ATNR (4 bulan)' },
      { k: 'reflek_grasping', label: 'Grasping reflex (6-12 bulan)' },
      { k: 'reflek_babinski', label: 'Babinski reflex (1-2 tahun)' },
      { k: 'reflek_step', label: 'Step reflex (2 bulan)' },
    ],
  },
  { title: 'Masa Pertumbuhan dan Perkembangan', fields: MILESTONES },
  { title: 'Pemeriksaan Penunjang', subtitle: 'Kondisi fisik, Tes BERA/MRI/CT Scan', half: true, fields: [{ k: 'pemeriksaan_penunjang', label: 'Hasil pemeriksaan', kind: 'textarea' }] },
  { title: 'Riwayat Sakit', subtitle: 'Rawat inap / rawat jalan', half: true, fields: [{ k: 'riwayat_sakit', label: 'Riwayat', kind: 'textarea' }] },
  {
    title: 'Interaksi Antar Personal',
    fields: [
      { k: 'kepribadian_anak', label: 'Kepribadian anak' },
      { k: 'tipe_sosialisasi', label: 'Sosialisasi' },
      { k: 'hobi_anak', label: 'Kegemaran anak', full: true },
    ],
  },
  { title: 'Masalah Wicara / Oral Motor', fields: ORAL_MOTOR },
  { title: 'Diagnosa', fields: [{ k: 'diagnosa', label: 'Diagnosa', kind: 'textarea', required: true }] },
  { title: 'Program Fisioterapi', half: true, fields: [{ k: 'program_fisioterapi', label: 'Program fisioterapi', kind: 'textarea' }] },
  { title: 'Program Tambahan', subtitle: 'Terapi Wicara, Terapi Okupasi, Terapi Perilaku', half: true, fields: [{ k: 'program_tambahan', label: 'Program tambahan', kind: 'textarea' }] },
  JADWAL(),
]

export const DURASI_OPTIONS = [
  { value: '<1_MINGGU', label: 'Kurang dari 1 minggu' },
  { value: '1MG_1BLN', label: '1 minggu - 1 bulan' },
  { value: '1_6_BLN', label: '1 bulan - 6 bulan' },
  { value: '>6_BLN', label: 'Lebih dari 6 bulan' },
]

const PSIKOLOG_SECTIONS: RmSectionDef[] = [
  {
    title: 'Data Keluarga',
    fields: [
      { k: 'hubungan', label: 'Hubungan (Anak Kandung/Keponakan, dll)', full: true },
      { k: 'anak_ke', label: 'Anak ke' },
      { k: 'jumlah_saudara', label: 'Dari … bersaudara' },
    ],
  },
  { title: 'Keluhan Utama', subtitle: 'Konseling individu', fields: [{ k: 'keluhan_utama', label: 'Keluhan utama', kind: 'textarea' }] },
  { title: 'Durasi Keluhan', half: true, fields: [{ k: 'durasi_keluhan', label: 'Durasi', kind: 'choice', options: DURASI_OPTIONS, full: true }] },
  { title: 'Harapan dari Sesi ini', half: true, fields: [{ k: 'harapan_sesi', label: 'Harapan', kind: 'textarea' }] },
  { title: 'Riwayat Sakit / Keluhan', subtitle: 'Rawat inap / rawat jalan / konsultasi / terapi', fields: [{ k: 'riwayat_sakit', label: 'Riwayat', kind: 'textarea' }] },
  { title: 'Diagnosa', fields: [{ k: 'diagnosa', label: 'Diagnosa', kind: 'textarea', required: true }] },
  {
    title: 'Tindak Lanjut *', subtitle: 'Isi minimal salah satu',
    fields: [
      { k: 'tl_konseling_lanjutan', label: 'Konseling lanjutan', kind: 'textarea' },
      { k: 'tl_psikoterapi', label: 'Psikoterapi', kind: 'textarea' },
    ],
  },
  { ...JADWAL(true), subtitle: 'Menyesuaikan individu dan jadwal kosong praktik' },
]

export const RM_TYPES: Record<GriyaRmType, {
  label: string
  formTitle: string        // subtitle on the intake page
  pdfTitle: string         // PDF header
  assessorLabel: string    // single-assessor label (non-default types)
  signRole: string         // PDF signature caption
  sections: RmSectionDef[]
}> = {
  DEFAULT: {
    label: 'Sensori Integrasi', formTitle: 'Rekam Medis Sensori Integrasi', pdfTitle: 'REKAM MEDIS SENSORI INTEGRASI',
    assessorLabel: 'Asesor Sensori Integrasi', signRole: 'Asesor', sections: DEFAULT_SECTIONS,
  },
  FISIOTERAPI: {
    label: 'Fisioterapi', formTitle: 'Rekam Medis Fisioterapi', pdfTitle: 'REKAM MEDIS FISIOTERAPI',
    assessorLabel: 'Fisioterapis', signRole: 'Fisioterapi', sections: FISIOTERAPI_SECTIONS,
  },
  PSIKOLOG: {
    label: 'Psikolog', formTitle: 'Rekam Medis Psikolog', pdfTitle: 'REKAM MEDIS PSIKOLOG',
    assessorLabel: 'Psikolog Klinis Penanggung Jawab', signRole: 'Psikolog Klinis Penanggung Jawab', sections: PSIKOLOG_SECTIONS,
  },
}

export const RM_TYPE_ORDER: GriyaRmType[] = ['FISIOTERAPI', 'PSIKOLOG', 'DEFAULT']

/** Every field key used by any form type — the intake page keeps all of them in state. */
export const ALL_RM_FIELD_KEYS: RmFieldKey[] = [...new Set(
  Object.values(RM_TYPES).flatMap((t) => t.sections.flatMap((s) => s.fields.map((f) => f.k))),
)]

/** Returns an error message when the form can't be completed yet, else null. */
export function validateRm(type: GriyaRmType, form: Partial<Record<RmFieldKey, string>>): string | null {
  const blank = (k: RmFieldKey) => !(form[k] ?? '').trim()
  for (const sec of RM_TYPES[type].sections) {
    for (const f of sec.fields) if (f.required && blank(f.k)) return `${f.label} wajib diisi sebelum menyelesaikan.`
  }
  if (type === 'PSIKOLOG' && blank('tl_konseling_lanjutan') && blank('tl_psikoterapi')) {
    return 'Tindak Lanjut wajib diisi (konseling lanjutan atau psikoterapi).'
  }
  return null
}

/** Human-readable value for list/PDF display (choice → option label). */
export function displayRmValue(f: RmFieldDef, raw: string): string {
  if (f.kind === 'choice') return f.options?.find((o) => o.value === raw)?.label ?? raw
  return raw
}
