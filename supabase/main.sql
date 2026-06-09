-- SCHEMA: public (token-optimised for Claude Code)
-- Roles: patient|therapist|admin (profiles.role), director|hr|finance|marketing|staff|therapist|manager (internal_profiles.role)
-- Key auth links: profiles.id = auth.users.id, internal_profiles.id = auth.users.id

-- == PUBLIC TABLES (patient-facing) ==

-- profiles: id(pk,fk→auth.users) email* full_name phone avatar_url role[patient|therapist|admin]* star_level[0-3]
CREATE TABLE public.profiles (
  id uuid PK FK→auth.users,
  email text NOT NULL,
  full_name text, phone text, avatar_url text,
  role user_role NOT NULL DEFAULT 'patient',
  star_level int NOT NULL DEFAULT 0 CHECK(0-3),
  created_at timestamptz, updated_at timestamptz
);

-- patients: id(pk) profile_id(fk→profiles) encrypted_* gender blood_type allergies[] medical_notes is_active member_type_id last_booking_*
-- plain (non-PII) fields: no_rm(UNIQUE partial) pekerjaan agama hobi kelurahan kecamatan kabupaten_kota provinsi phone_hash
-- PII encrypted AES-256-GCM via lib/encryption.ts (server-only). No branch_id — shared with gangsehat.com.
CREATE TABLE public.patients (
  id uuid PK,
  profile_id uuid FK→profiles,
  encrypted_name text NOT NULL, encrypted_phone text NOT NULL,
  encrypted_address text, encrypted_id_number text, encrypted_birth_date text, encrypted_emergency_contact text,
  gender text CHECK(male|female|other), blood_type text CHECK(A|B|AB|O|unknown),
  allergies text[], medical_notes text, is_active bool NOT NULL DEFAULT true,
  member_type_id int FK→member_type,
  last_booking_city text, last_location_lat float, last_location_lng float, last_booking_age int,
  no_rm text, pekerjaan text, agama text, hobi text,
  kelurahan text, kecamatan text, kabupaten_kota text, provinsi text,
  phone_hash text,
  created_at timestamptz, updated_at timestamptz
);

-- therapists: id(pk) profile_id(fk→profiles) specializations[] certifications[] license_number experience_years bio is_available working_hours(jsonb) service_areas[] current_location(jsonb) average_rating total_reviews avatar_url
CREATE TABLE public.therapists (
  id uuid PK,
  profile_id uuid FK→profiles,
  specializations text[] NOT NULL DEFAULT '{}',
  certifications text[] DEFAULT '{}',
  license_number text, experience_years int DEFAULT 0, bio text,
  is_available bool NOT NULL DEFAULT true,
  working_hours jsonb, service_areas text[], current_location jsonb,
  average_rating numeric DEFAULT 0, total_reviews int DEFAULT 0,
  avatar_url text, created_at timestamptz, updated_at timestamptz
);

-- bookings: id(pk) patient_id(fk→patients) therapist_id(fk→therapists) service_type scheduled_date scheduled_time duration_minutes status[waiting_confirmation|...]
-- also: encrypted_address location_notes estimated_price patient_notes therapist_notes admin_notes
-- payment: payment_method payment_receipt_url bank_name bank_account_number bank_account_name discount_percentage discounted_price distance_fee
-- guest fields: guest_name guest_email guest_phone guest_age guest_gender is_for_other parent_name parent_job
-- timestamps: confirmed_at started_at completed_at cancelled_at cancellation_reason
-- rating: rating[1-5] feedback
CREATE TABLE public.bookings (
  id uuid PK,
  patient_id uuid FK→patients, therapist_id uuid FK→therapists,
  service_type text NOT NULL, status text DEFAULT 'waiting_confirmation',
  scheduled_date date NOT NULL, scheduled_time text NOT NULL, duration_minutes int DEFAULT 60,
  city varchar, encrypted_address text, location_notes text, location_lat float, location_lng float,
  estimated_price numeric, discounted_price numeric, discount_percentage numeric, distance_fee int DEFAULT 0,
  payment_method text, payment_receipt_url text, bank_name text, bank_account_number text, bank_account_name text,
  patient_notes text, therapist_notes text, admin_notes text,
  rating int CHECK(1-5), feedback text,
  guest_name varchar, guest_email varchar, guest_phone varchar, guest_age int, guest_gender text CHECK(male|female),
  is_for_other bool DEFAULT false, parent_name text, parent_job text,
  confirmed_at timestamptz, started_at timestamptz, completed_at timestamptz,
  cancelled_at timestamptz, cancellation_reason text,
  created_at timestamptz, updated_at timestamptz
);

-- treatment_logs: id(pk) booking_id(fk→bookings) therapist_id(fk→therapists) patient_id(fk→patients)
-- treatment_type treatment_date duration_minutes symptoms diagnosis treatment_provided patient_response recommendations
-- vitals(jsonb) follow_up_required follow_up_notes next_appointment_date attachments[]
-- guest_name guest_email guest_phone
CREATE TABLE public.treatment_logs (
  id uuid PK,
  booking_id uuid NOT NULL FK→bookings,
  therapist_id uuid NOT NULL FK→therapists,
  patient_id uuid FK→patients,
  treatment_type text NOT NULL, treatment_date date NOT NULL, duration_minutes int NOT NULL,
  symptoms text, diagnosis text, treatment_provided text NOT NULL,
  patient_response text, recommendations text, vitals jsonb,
  follow_up_required bool DEFAULT false, follow_up_notes text, next_appointment_date date,
  attachments text[] DEFAULT '{}',
  guest_name varchar, guest_email varchar, guest_phone varchar,
  created_at timestamptz, updated_at timestamptz
);

-- booking_history: id(pk) booking_id(fk→bookings) previous_status new_status changed_by_user_id(fk→auth.users) changed_by_role cancellation_reason therapist_id(fk→therapists)
CREATE TABLE public.booking_history (
  id uuid PK,
  booking_id uuid NOT NULL FK→bookings,
  previous_status text, new_status text NOT NULL,
  changed_by_user_id uuid FK→auth.users, changed_by_role text,
  cancellation_reason text, therapist_id uuid FK→therapists,
  created_at timestamptz
);

-- therapist_ratings: id(pk) therapist_id(fk→therapists) patient_id(fk→patients) booking_id(fk→bookings,unique) rating[1-5] feedback
CREATE TABLE public.therapist_ratings (
  id uuid PK,
  therapist_id uuid NOT NULL FK→therapists,
  patient_id uuid NOT NULL FK→patients,
  booking_id uuid NOT NULL UNIQUE FK→bookings,
  rating int NOT NULL CHECK(1-5), feedback text,
  created_at timestamptz, updated_at timestamptz
);

-- == LOOKUP / CONFIG TABLES ==

-- member_type: id(pk,serial) name(unique)
CREATE TABLE public.member_type (id serial PK, name varchar NOT NULL UNIQUE, created_at timestamptz);

-- service_types: id(pk) name(unique) description icon price* duration_minutes is_active display_order discount_percentage discount_until category image_url
CREATE TABLE public.service_types (
  id uuid PK, name text NOT NULL UNIQUE, description text, icon text,
  price numeric NOT NULL, duration_minutes int DEFAULT 60, is_active bool DEFAULT true,
  display_order int, discount_percentage numeric DEFAULT 0, discount_until date,
  category text NOT NULL DEFAULT 'fisioterapi', image_url text,
  created_at timestamptz, updated_at timestamptz
);

-- service_areas: id(pk) name(unique) city address phone hours latitude longitude map_url is_active
CREATE TABLE public.service_areas (
  id uuid PK, name text NOT NULL UNIQUE, city text NOT NULL,
  address text, phone text, hours text,
  latitude numeric, longitude numeric, map_url text,
  is_active bool DEFAULT true, created_at timestamptz, updated_at timestamptz
);

-- clinic_settings: id(pk) setting_key(unique) setting_value
CREATE TABLE public.clinic_settings (id uuid PK, setting_key text NOT NULL UNIQUE, setting_value text, created_at timestamptz, updated_at timestamptz);

-- dp_settings: id(pk) is_active dp_percentage[50] transfer_enabled qris_enabled
CREATE TABLE public.dp_settings (
  id uuid PK, is_active bool DEFAULT false,
  dp_percentage numeric DEFAULT 50, transfer_enabled bool DEFAULT true, qris_enabled bool DEFAULT true,
  created_at timestamptz, updated_at timestamptz
);

-- bank_accounts: id(pk) bank_name account_number account_name is_active sort_order
CREATE TABLE public.bank_accounts (
  id uuid PK, bank_name varchar NOT NULL, account_number varchar NOT NULL,
  account_name varchar NOT NULL, is_active bool DEFAULT true, sort_order int DEFAULT 0,
  created_at timestamptz, updated_at timestamptz
);

-- == POINTS SYSTEM ==

-- session_packages: id(pk) name points_count price is_active card_type(fk→member_type)
CREATE TABLE public.session_packages (
  id uuid PK, name varchar NOT NULL, points_count int NOT NULL CHECK(>0),
  price numeric DEFAULT 0, is_active bool DEFAULT true,
  card_type int FK→member_type, created_at timestamptz, updated_at timestamptz
);

-- patient_points: id(pk) patient_id(fk→patients,unique) total_points used_points
CREATE TABLE public.patient_points (
  id uuid PK, patient_id uuid NOT NULL UNIQUE FK→patients,
  total_points int DEFAULT 0, used_points int DEFAULT 0,
  created_at timestamptz, updated_at timestamptz
);

-- point_transactions: id(pk) patient_id(fk→patients) package_id(fk→session_packages) points_change type[purchase|redeem|adjustment] booking_id(fk→bookings) notes created_by(fk→profiles)
CREATE TABLE public.point_transactions (
  id uuid PK, patient_id uuid NOT NULL FK→patients,
  package_id uuid FK→session_packages, points_change int NOT NULL,
  type varchar NOT NULL CHECK(purchase|redeem|adjustment),
  booking_id uuid FK→bookings, notes text, created_by uuid FK→profiles,
  created_at timestamptz
);

-- == CMS TABLES (public read, admin write) ==

-- success_stories: id(pk) patient_name condition quote image_url display_order is_published
CREATE TABLE public.success_stories (id uuid PK, patient_name varchar NOT NULL, condition varchar NOT NULL, quote text NOT NULL, image_url text, display_order int DEFAULT 0, is_published bool DEFAULT false, created_at timestamptz, updated_at timestamptz);

-- gallery_videos: id(pk) title_id title_en description_id description_en video_id thumbnail_url display_order is_active
CREATE TABLE public.gallery_videos (id uuid PK, title_id varchar NOT NULL, title_en varchar NOT NULL, description_id text NOT NULL, description_en text NOT NULL, video_id varchar NOT NULL, thumbnail_url text, display_order int DEFAULT 0, is_active bool DEFAULT true, created_at timestamptz, updated_at timestamptz);

-- blog_posts: id(pk) title_id title_en slug(unique) excerpt_id excerpt_en content_id content_en author category image_url published_at is_published meta_*
CREATE TABLE public.blog_posts (id uuid PK, title_id varchar NOT NULL, title_en varchar NOT NULL, slug varchar NOT NULL UNIQUE, excerpt_id text NOT NULL, excerpt_en text NOT NULL, content_id text NOT NULL, content_en text NOT NULL, author varchar NOT NULL, category varchar NOT NULL, image_url text, published_at timestamptz, is_published bool DEFAULT false, meta_title_id varchar, meta_description_id text, meta_title_en varchar, meta_description_en text, created_at timestamptz, updated_at timestamptz);

-- homepage_services: id(pk) title_id title_en description_id description_en icon image_url display_order is_active booking_type
CREATE TABLE public.homepage_services (id uuid PK, title_id text NOT NULL, title_en text NOT NULL, description_id text DEFAULT '', description_en text DEFAULT '', icon text DEFAULT '💪', image_url text, display_order int DEFAULT 0, is_active bool DEFAULT true, booking_type text DEFAULT 'fisioterapi', created_at timestamptz, updated_at timestamptz);

-- == INTERNAL / BRANCH TABLES ==

-- branches: id(pk) name address phone is_active
CREATE TABLE public.branches (id uuid PK, name text NOT NULL, address text, phone text, is_active bool DEFAULT true, created_at timestamptz, updated_at timestamptz);

-- internal_profiles: id(pk,fk→auth.users) full_name email phone role[director|hr|finance|marketing|staff|therapist|manager]* branch_id(fk→branches) avatar_url is_active
-- NOTE: this is the identity table for all internal staff; id = auth.uid()
-- therapist: branch-scoped clinical staff (patient_visits, own attendance/leave/targets)
-- manager: branch-scoped director equivalent (full access within own branch)
CREATE TABLE public.internal_profiles (
  id uuid PK FK→auth.users,
  full_name text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '',
  phone text, role internal_user_role NOT NULL DEFAULT 'marketing',
  branch_id uuid FK→branches, avatar_url text, is_active bool DEFAULT true,
  created_at timestamptz, updated_at timestamptz
);

-- internal_jabatan: id(pk) nama  [position/job title lookup]
CREATE TABLE public.internal_jabatan (id uuid PK, nama varchar NOT NULL, created_at timestamptz);

-- internal_users: id(pk) profile_id(fk→profiles) jabatan_id(fk→internal_jabatan) is_active
-- NOTE: links public patient-side profiles to internal job titles
CREATE TABLE public.internal_users (id uuid PK, profile_id uuid NOT NULL FK→profiles, jabatan_id uuid FK→internal_jabatan, is_active bool DEFAULT true, created_at timestamptz);

-- internal_layanan: id(pk) nama kategori jumlah_sesi harga is_active  [internal service catalog]
CREATE TABLE public.internal_layanan (id uuid PK, nama varchar NOT NULL, kategori varchar NOT NULL, jumlah_sesi int, harga numeric DEFAULT 0, is_active bool DEFAULT true, created_at timestamptz);

-- internal_jam_shift: id(pk) shift[PAGI|SORE] jam_mulai jam_selesai
CREATE TABLE public.internal_jam_shift (id uuid PK, shift varchar NOT NULL CHECK(PAGI|SORE), jam_mulai time NOT NULL, jam_selesai time NOT NULL, created_at timestamptz);

-- internal_master_jadwal: id(pk) therapist_id(fk→therapists) hari shift[PAGI|SORE]  [recurring schedule template]
CREATE TABLE public.internal_master_jadwal (id uuid PK, therapist_id uuid NOT NULL FK→therapists, hari varchar NOT NULL, shift varchar NOT NULL CHECK(PAGI|SORE), created_at timestamptz);

-- internal_jadwal: id(pk) therapist_id(fk→therapists) tanggal shift[PAGI|SORE] status[TERSEDIA|OFF|CUTI|MASUK]  [daily schedule]
CREATE TABLE public.internal_jadwal (id uuid PK, therapist_id uuid NOT NULL FK→therapists, tanggal date NOT NULL, shift varchar NOT NULL CHECK(PAGI|SORE), status varchar NOT NULL DEFAULT 'TERSEDIA' CHECK(TERSEDIA|OFF|CUTI|MASUK), created_at timestamptz);

-- internal_cuti: id(pk) user_id(fk→internal_users) tanggal_mulai tanggal_selesai alasan bukti_url status[MENUNGGU|DISETUJUI|DITOLAK] disetujui_oleh(fk→internal_users)
CREATE TABLE public.internal_cuti (id uuid PK, user_id uuid NOT NULL FK→internal_users, tanggal_mulai date NOT NULL, tanggal_selesai date NOT NULL, alasan text NOT NULL, bukti_url text, status varchar NOT NULL DEFAULT 'MENUNGGU' CHECK(MENUNGGU|DISETUJUI|DITOLAK), disetujui_oleh uuid FK→internal_users, created_at timestamptz);

-- internal_target: id(pk) therapist_id(fk→therapists) bulan[1-12] tahun target_terapi_awal target_paket_klinik target_kunjungan target_homevisit_paket approved
CREATE TABLE public.internal_target (id uuid PK, therapist_id uuid NOT NULL FK→therapists, bulan int NOT NULL CHECK(1-12), tahun int NOT NULL, target_terapi_awal int DEFAULT 0, target_paket_klinik int DEFAULT 0, target_kunjungan int DEFAULT 0, target_homevisit_paket int DEFAULT 0, approved bool DEFAULT false, created_at timestamptz);

-- internal_order_meta: id(pk) booking_id(fk→bookings) kode_transaksi(unique) status_bayar[Belum Lunas|Lunas] catatan_admin
CREATE TABLE public.internal_order_meta (id uuid PK, booking_id uuid NOT NULL FK→bookings, kode_transaksi varchar NOT NULL UNIQUE, status_bayar varchar DEFAULT 'Belum Lunas' CHECK(Belum Lunas|Lunas), catatan_admin text, created_at timestamptz);

-- internal_wilayah: id(pk) kode(unique) nama tipe[provinsi|kabupaten|kecamatan|kelurahan] parent_id(fk→self)  [region hierarchy]
CREATE TABLE public.internal_wilayah (id uuid PK, kode varchar NOT NULL UNIQUE, nama varchar NOT NULL, tipe varchar NOT NULL CHECK(provinsi|kabupaten|kecamatan|kelurahan), parent_id uuid FK→internal_wilayah.id, CONSTRAINT self_ref);

-- internal_referensi: id(pk) kunci nilai tipe grup  [generic key-value reference data]
CREATE TABLE public.internal_referensi (id uuid PK, kunci varchar NOT NULL, nilai text NOT NULL, tipe varchar NOT NULL, grup varchar, created_at timestamptz);

-- internal_konfigurasi: id(pk) kunci(unique) nilai  [system config key-value]
CREATE TABLE public.internal_konfigurasi (id uuid PK, kunci varchar NOT NULL UNIQUE, nilai text NOT NULL, updated_at timestamptz);

-- == BRANCH OPERATIONS ==

-- patient_visits: id(pk) patient_id(fk→patients) branch_id(fk→branches) visit_date visit_time attending_staff_id(fk→internal_profiles)
-- status[scheduled|completed|cancelled|no_show] kehadiran[HADIR|TIDAK HADIR] shift[PAGI|SORE]
-- service_type[TERAPI AWAL|PAKET TERAPI|SESI TERAPI|TA VISIT|SESI VISIT|PAKET VISIT|LAINNYA]
-- regio(body_region) sumber_pasien package_id(fk→patient_packages) chief_complaint diagnosis treatment notes
-- NOTE: status=scheduling workflow; kehadiran=attendance record — independent fields
CREATE TABLE public.patient_visits (
  id uuid PK, patient_id uuid NOT NULL FK→patients, branch_id uuid NOT NULL FK→branches,
  visit_date date DEFAULT CURRENT_DATE, visit_time time,
  attending_staff_id uuid FK→internal_profiles,
  status text DEFAULT 'scheduled' CHECK(scheduled|completed|cancelled|no_show),
  kehadiran text CHECK(HADIR|TIDAK HADIR),
  shift text CHECK(PAGI|SORE),
  service_type text CHECK(TERAPI AWAL|PAKET TERAPI|SESI TERAPI|TA VISIT|SESI VISIT|PAKET VISIT|LAINNYA),
  regio text, sumber_pasien text,
  package_id uuid FK→patient_packages,
  chief_complaint text, diagnosis text, treatment text, notes text,
  created_at timestamptz, updated_at timestamptz
);

-- transactions: id(pk) branch_id(fk→branches) patient_id(fk→patients) visit_id(fk→patient_visits)
-- type[income|expense] category amount(jumlah_bayar) harga(full_price) discount outstanding(GENERATED=harga-amount-discount)
-- payment_method[TUNAI|TRANSFER BCA|EDC BCA] payment_status[LUNAS|DP|PELUNASAN] penjamin(guarantor)
-- fisio_id(fk→internal_profiles) status[pending|confirmed|rejected]
-- NOTE: status=approval workflow; payment_status=payment detail — independent fields
CREATE TABLE public.transactions (
  id uuid PK, branch_id uuid NOT NULL FK→branches,
  patient_id uuid FK→patients, visit_id uuid FK→patient_visits,
  type text NOT NULL CHECK(income|expense), category text NOT NULL,
  amount numeric NOT NULL, harga numeric DEFAULT 0, discount numeric DEFAULT 0,
  outstanding numeric GENERATED(harga-amount-discount),
  description text, receipt_url text,
  status text DEFAULT 'pending' CHECK(pending|confirmed|rejected), rejection_reason text,
  payment_method text CHECK(TUNAI|TRANSFER BCA|EDC BCA),
  payment_status text CHECK(LUNAS|DP|PELUNASAN),
  penjamin text, fisio_id uuid FK→internal_profiles,
  recorded_by uuid FK→internal_profiles, confirmed_by uuid FK→internal_profiles,
  transaction_date date DEFAULT CURRENT_DATE, created_at timestamptz, updated_at timestamptz
);

-- branch_financial_reports: id(pk) branch_id(fk→branches) period_year period_month[1-12] total_income total_expense net_profit patient_count visit_count status[draft|submitted|approved|rejected] submitted_by reviewed_by notes
-- UNIQUE(branch_id, period_year, period_month)
CREATE TABLE public.branch_financial_reports (id uuid PK, branch_id uuid NOT NULL FK→branches, period_year int NOT NULL, period_month int NOT NULL CHECK(1-12), total_income numeric DEFAULT 0, total_expense numeric DEFAULT 0, net_profit numeric GENERATED, patient_count int DEFAULT 0, visit_count int DEFAULT 0, submitted_by uuid FK→internal_profiles, submitted_at timestamptz, reviewed_by uuid FK→internal_profiles, reviewed_at timestamptz, status text DEFAULT 'draft' CHECK(draft|submitted|approved|rejected), notes text, created_at timestamptz, updated_at timestamptz);

-- attendance: id(pk) staff_id(fk→internal_profiles) branch_id(fk→branches) date check_in check_out status[present|absent|late|leave|sick] notes recorded_by(fk→internal_profiles)
-- UNIQUE(staff_id, date)
CREATE TABLE public.attendance (id uuid PK, staff_id uuid NOT NULL FK→internal_profiles, branch_id uuid NOT NULL FK→branches, date date DEFAULT CURRENT_DATE, check_in timestamptz, check_out timestamptz, status text DEFAULT 'present' CHECK(present|absent|late|leave|sick), notes text, recorded_by uuid FK→internal_profiles, created_at timestamptz);

-- leave_requests: id(pk) staff_id(fk→internal_profiles) branch_id(fk→branches) start_date end_date reason proof_url status[pending|approved|rejected] reviewed_by(fk→internal_profiles) reviewed_at rejection_note
CREATE TABLE public.leave_requests (id uuid PK, staff_id uuid NOT NULL FK→internal_profiles, branch_id uuid FK→branches, start_date date NOT NULL, end_date date NOT NULL, reason text NOT NULL, proof_url text, status text DEFAULT 'pending' CHECK(pending|approved|rejected), reviewed_by uuid FK→internal_profiles, reviewed_at timestamptz, rejection_note text, created_at timestamptz, updated_at timestamptz);

-- campaigns: id(pk) branch_id(fk→branches) title description channel[social_media|whatsapp|email|flyer|other] start_date end_date budget actual_spend target_reach actual_reach status[draft|active|completed|cancelled] created_by(fk→internal_profiles)
CREATE TABLE public.campaigns (id uuid PK, branch_id uuid NOT NULL FK→branches, title text NOT NULL, description text, channel text CHECK(social_media|whatsapp|email|flyer|other), start_date date, end_date date, budget numeric DEFAULT 0, actual_spend numeric DEFAULT 0, target_reach int, actual_reach int, status text DEFAULT 'draft' CHECK(draft|active|completed|cancelled), created_by uuid FK→internal_profiles, created_at timestamptz, updated_at timestamptz);

-- staff_targets: id(pk) staff_id(fk→internal_profiles) branch_id(fk→branches) bulan[1-12] tahun target_ta target_paket_klinik target_kunjungan target_visit notes status[pending|approved|rejected] reviewed_by reviewed_at rejection_note
-- UNIQUE(staff_id, bulan, tahun)
CREATE TABLE public.staff_targets (id uuid PK, staff_id uuid NOT NULL FK→internal_profiles, branch_id uuid FK→branches, bulan int NOT NULL CHECK(1-12), tahun int NOT NULL, target_ta int DEFAULT 0, target_paket_klinik int DEFAULT 0, target_kunjungan int DEFAULT 0, target_visit int DEFAULT 0, notes text, status text DEFAULT 'pending' CHECK(pending|approved|rejected), reviewed_by uuid FK→internal_profiles, reviewed_at timestamptz, rejection_note text, created_at timestamptz, updated_at timestamptz);

-- branch_targets: id(pk) branch_id(fk→branches) bulan[1-12] tahun target_ta target_paket_klinik target_kunjungan target_visit notes status[pending|approved|rejected] set_by reviewed_by reviewed_at rejection_note
-- UNIQUE(branch_id, bulan, tahun)
CREATE TABLE public.branch_targets (id uuid PK, branch_id uuid NOT NULL FK→branches, bulan int NOT NULL CHECK(1-12), tahun int NOT NULL, target_ta int DEFAULT 0, target_paket_klinik int DEFAULT 0, target_kunjungan int DEFAULT 0, target_visit int DEFAULT 0, notes text, status text DEFAULT 'pending' CHECK(pending|approved|rejected), set_by uuid FK→internal_profiles, reviewed_by uuid FK→internal_profiles, reviewed_at timestamptz, rejection_note text, created_at timestamptz, updated_at timestamptz);

-- user_notifications: id(pk) user_id(fk→internal_profiles) target_role title message link is_read
CREATE TABLE public.user_notifications (id uuid PK, user_id uuid FK→internal_profiles, target_role internal_user_role, title text NOT NULL, message text, link text, is_read bool DEFAULT false, created_at timestamptz);

-- schedules: id(pk) staff_id(fk→internal_profiles) branch_id(fk→branches) hari[SENIN|SELASA|RABU|KAMIS|JUMAT|SABTU|AHAD] shift[PAGI|SORE] jam_mulai jam_selesai status[AKTIF|OFF] notes
CREATE TABLE public.schedules (
  id uuid PK, staff_id uuid NOT NULL FK→internal_profiles, branch_id uuid FK→branches,
  hari varchar NOT NULL CHECK(SENIN|SELASA|RABU|KAMIS|JUMAT|SABTU|AHAD),
  shift varchar NOT NULL CHECK(PAGI|SORE),
  jam_mulai time DEFAULT '09:00', jam_selesai time DEFAULT '17:00',
  status varchar DEFAULT 'AKTIF' CHECK(AKTIF|OFF),
  notes text, created_at timestamptz
);

-- == PATIENT PACKAGES ==

-- patient_packages: id(pk) patient_id(fk→patients) branch_id(fk→branches) package_name package_type[fixed|flexible] total_sessions
-- jenis_paket[P1|P2] mulai_paket[NEW|EXT.] operational_status[ON|OFF|PENDING] completion_status[LANJUT|SEMBUH|TIDAK LANJUT|STOP]
-- t1..t10(session dates) status[active|completed|cancelled] created_by(fk→internal_profiles)
CREATE TABLE public.patient_packages (
  id uuid PK, patient_id uuid NOT NULL FK→patients, branch_id uuid FK→branches,
  package_name text NOT NULL, package_type text DEFAULT 'flexible' CHECK(fixed|flexible),
  total_sessions int NOT NULL DEFAULT 1 CHECK(>0),
  jenis_paket text CHECK(P1|P2), mulai_paket text CHECK(NEW|EXT.),
  operational_status text DEFAULT 'ON' CHECK(ON|OFF|PENDING),
  completion_status text CHECK(LANJUT|SEMBUH|TIDAK LANJUT|STOP),
  t1 date, t2 date, t3 date, t4 date, t5 date,
  t6 date, t7 date, t8 date, t9 date, t10 date,
  notes text, status text DEFAULT 'active' CHECK(active|completed|cancelled),
  created_by uuid FK→internal_profiles, created_at timestamptz, updated_at timestamptz
);

-- == ORDER SESSION & PAYMENT TRACKING ==

-- booking_sessions: id(pk) booking_id(fk→bookings) session_number(unique with booking_id) tanggal jam therapist_id(fk→therapists) kehadiran status[Belum Ditangani|Hadir|Tidak Hadir|Batal] nominal_bayar metode_pembayaran keterangan catatan_admin wa_order_count wa_reminder_count
CREATE TABLE public.booking_sessions (
  id uuid PK,
  booking_id uuid NOT NULL FK→bookings ON DELETE CASCADE,
  session_number int NOT NULL,
  tanggal date, jam time,
  therapist_id uuid FK→therapists,
  kehadiran text,
  status text NOT NULL DEFAULT 'Belum Ditangani' CHECK(Belum Ditangani|Hadir|Tidak Hadir|Batal),
  nominal_bayar numeric DEFAULT 0,
  metode_pembayaran text, keterangan text, catatan_admin text,
  wa_order_count int DEFAULT 0, wa_reminder_count int DEFAULT 0,
  created_at timestamptz, updated_at timestamptz,
  UNIQUE(booking_id, session_number)
);

-- booking_payments: id(pk) booking_id(fk→bookings) tanggal nominal waktu_bayar metode catatan created_by(fk→internal_profiles)
CREATE TABLE public.booking_payments (
  id uuid PK,
  booking_id uuid NOT NULL FK→bookings ON DELETE CASCADE,
  tanggal date NOT NULL, nominal numeric NOT NULL,
  waktu_bayar text, metode text, catatan text,
  created_by uuid FK→internal_profiles,
  created_at timestamptz
);

-- == SALARY & PAYROLL ==

-- salary_settings: id(pk) role(unique) base_salary transport_allowance meal_allowance bonus_target_pct updated_by(fk→internal_profiles)
CREATE TABLE public.salary_settings (
  id uuid PK, role text NOT NULL UNIQUE,
  base_salary numeric DEFAULT 0, transport_allowance numeric DEFAULT 0,
  meal_allowance numeric DEFAULT 0, bonus_target_pct numeric DEFAULT 0,
  updated_by uuid FK→internal_profiles, updated_at timestamptz
);

-- employee_salaries: id(pk) staff_id(fk→internal_profiles,unique) base_salary transport_allowance meal_allowance other_allowance notes updated_by(fk→internal_profiles)
-- Per-employee salary overrides (takes precedence over salary_settings role defaults)
CREATE TABLE public.employee_salaries (
  id uuid PK, staff_id uuid NOT NULL UNIQUE FK→internal_profiles,
  base_salary numeric, transport_allowance numeric, meal_allowance numeric,
  other_allowance numeric DEFAULT 0,
  notes text, updated_by uuid FK→internal_profiles,
  updated_at timestamptz, created_at timestamptz
);

-- payroll_records: id(pk) staff_id(fk→internal_profiles) branch_id(fk→branches) period_month[1-12] period_year
-- base_salary transport_allowance meal_allowance other_allowance bonus_achievement deductions
-- status[draft|confirmed|paid] confirmed_by paid_at transaction_id(fk→transactions) created_by
CREATE TABLE public.payroll_records (
  id uuid PK, staff_id uuid NOT NULL FK→internal_profiles, branch_id uuid FK→branches,
  period_month int NOT NULL CHECK(1-12), period_year int NOT NULL,
  base_salary numeric DEFAULT 0, transport_allowance numeric DEFAULT 0,
  meal_allowance numeric DEFAULT 0, other_allowance numeric DEFAULT 0,
  bonus_achievement numeric DEFAULT 0, deductions numeric DEFAULT 0,
  notes text, status text DEFAULT 'draft' CHECK(draft|confirmed|paid),
  confirmed_by uuid FK→internal_profiles, confirmed_at timestamptz,
  paid_at timestamptz, transaction_id uuid FK→transactions,
  created_by uuid FK→internal_profiles, created_at timestamptz, updated_at timestamptz
);
