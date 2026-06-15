-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  phone text,
  avatar_url text,
  role USER-DEFINED NOT NULL DEFAULT 'patient'::user_role,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  star_level integer NOT NULL DEFAULT 0 CHECK (star_level >= 0 AND star_level <= 3),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.patients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  encrypted_name text NOT NULL,
  encrypted_phone text NOT NULL,
  encrypted_address text,
  encrypted_id_number text,
  encrypted_birth_date text,
  encrypted_emergency_contact text,
  gender text CHECK (gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])),
  blood_type text CHECK (blood_type = ANY (ARRAY['A'::text, 'B'::text, 'AB'::text, 'O'::text, 'unknown'::text])),
  allergies ARRAY,
  medical_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  member_type_id integer,
  last_booking_city text,
  last_location_lat double precision,
  last_location_lng double precision,
  last_booking_age integer,
  no_rm text,
  pekerjaan text,
  agama text,
  hobi text,
  kelurahan text,
  kecamatan text,
  kabupaten_kota text,
  provinsi text,
  phone_hash text,
  CONSTRAINT patients_pkey PRIMARY KEY (id),
  CONSTRAINT patients_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT patients_member_type_id_fkey FOREIGN KEY (member_type_id) REFERENCES public.member_type(id)
);
CREATE TABLE public.therapists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  specializations ARRAY NOT NULL DEFAULT '{}'::text[],
  certifications ARRAY DEFAULT '{}'::text[],
  license_number text,
  experience_years integer DEFAULT 0,
  bio text,
  is_available boolean NOT NULL DEFAULT true,
  working_hours jsonb DEFAULT '{"friday": {"end": "17:00", "start": "09:00"}, "monday": {"end": "17:00", "start": "09:00"}, "tuesday": {"end": "17:00", "start": "09:00"}, "thursday": {"end": "17:00", "start": "09:00"}, "wednesday": {"end": "17:00", "start": "09:00"}}'::jsonb,
  service_areas ARRAY DEFAULT '{}'::text[],
  current_location jsonb,
  average_rating numeric DEFAULT 0.00,
  total_reviews integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  avatar_url text,
  CONSTRAINT therapists_pkey PRIMARY KEY (id),
  CONSTRAINT therapists_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid,
  therapist_id uuid,
  service_type text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time text NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  encrypted_address text,
  location_notes text,
  estimated_price numeric,
  patient_notes text,
  therapist_notes text,
  admin_notes text,
  confirmed_at timestamp with time zone,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancellation_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  guest_name character varying,
  guest_email character varying,
  guest_phone character varying,
  status text DEFAULT 'waiting_confirmation'::text,
  city character varying,
  discount_percentage numeric,
  discounted_price numeric,
  payment_method text,
  payment_receipt_url text,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  guest_age integer,
  guest_gender text CHECK (guest_gender = ANY (ARRAY['male'::text, 'female'::text])),
  is_for_other boolean DEFAULT false,
  location_lat double precision,
  location_lng double precision,
  distance_fee integer NOT NULL DEFAULT 0,
  parent_name text,
  parent_job text,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT bookings_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id)
);
CREATE TABLE public.treatment_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  therapist_id uuid NOT NULL,
  patient_id uuid,
  treatment_type text NOT NULL,
  treatment_date date NOT NULL,
  duration_minutes integer NOT NULL,
  symptoms text,
  diagnosis text,
  treatment_provided text NOT NULL,
  patient_response text,
  recommendations text,
  vitals jsonb,
  follow_up_required boolean DEFAULT false,
  follow_up_notes text,
  next_appointment_date date,
  attachments ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  guest_name character varying,
  guest_email character varying,
  guest_phone character varying,
  CONSTRAINT treatment_logs_pkey PRIMARY KEY (id),
  CONSTRAINT treatment_logs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT treatment_logs_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id),
  CONSTRAINT treatment_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id)
);
CREATE TABLE public.booking_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  changed_by_user_id uuid,
  changed_by_role text,
  cancellation_reason text,
  therapist_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT booking_history_pkey PRIMARY KEY (id),
  CONSTRAINT booking_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT booking_history_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id)
);
CREATE TABLE public.service_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  price numeric NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  discount_percentage numeric DEFAULT 0,
  discount_until date,
  category text NOT NULL DEFAULT 'fisioterapi'::text,
  image_url text,
  CONSTRAINT service_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.service_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  city text NOT NULL,
  address text,
  phone text,
  hours text,
  latitude numeric,
  longitude numeric,
  map_url text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT service_areas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clinic_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clinic_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.therapist_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  booking_id uuid NOT NULL UNIQUE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT therapist_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT therapist_ratings_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id),
  CONSTRAINT therapist_ratings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT therapist_ratings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.member_type (
  id integer NOT NULL DEFAULT nextval('member_type_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT member_type_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dp_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  dp_percentage numeric NOT NULL DEFAULT 50.00,
  transfer_enabled boolean NOT NULL DEFAULT true,
  qris_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dp_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.session_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  points_count integer NOT NULL CHECK (points_count > 0),
  price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  card_type integer,
  CONSTRAINT session_packages_pkey PRIMARY KEY (id),
  CONSTRAINT session_packages_card_type_fkey FOREIGN KEY (card_type) REFERENCES public.member_type(id)
);
CREATE TABLE public.patient_points (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL UNIQUE,
  total_points integer NOT NULL DEFAULT 0,
  used_points integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT patient_points_pkey PRIMARY KEY (id),
  CONSTRAINT patient_points_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id)
);
CREATE TABLE public.point_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  package_id uuid,
  points_change integer NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['purchase'::character varying, 'redeem'::character varying, 'adjustment'::character varying]::text[])),
  booking_id uuid,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT point_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT point_transactions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT point_transactions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.session_packages(id),
  CONSTRAINT point_transactions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT point_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.success_stories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_name character varying NOT NULL,
  condition character varying NOT NULL,
  quote text NOT NULL,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT success_stories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.gallery_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title_id character varying NOT NULL,
  title_en character varying NOT NULL,
  description_id text NOT NULL,
  description_en text NOT NULL,
  video_id character varying NOT NULL,
  thumbnail_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gallery_videos_pkey PRIMARY KEY (id)
);
CREATE TABLE public.blog_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title_id character varying NOT NULL,
  title_en character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  excerpt_id text NOT NULL,
  excerpt_en text NOT NULL,
  content_id text NOT NULL,
  content_en text NOT NULL,
  author character varying NOT NULL,
  category character varying NOT NULL,
  image_url text,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT false,
  meta_title_id character varying,
  meta_description_id text,
  meta_title_en character varying,
  meta_description_en text,
  CONSTRAINT blog_posts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.homepage_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title_id text NOT NULL,
  title_en text NOT NULL,
  description_id text NOT NULL DEFAULT ''::text,
  description_en text NOT NULL DEFAULT ''::text,
  icon text NOT NULL DEFAULT '💪'::text,
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  booking_type text NOT NULL DEFAULT 'fisioterapi'::text,
  CONSTRAINT homepage_services_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bank_name character varying NOT NULL,
  account_number character varying NOT NULL,
  account_name character varying NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bank_accounts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.internal_jabatan (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nama character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_jabatan_pkey PRIMARY KEY (id)
);
CREATE TABLE public.internal_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  jabatan_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_users_pkey PRIMARY KEY (id),
  CONSTRAINT internal_users_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT internal_users_jabatan_id_fkey FOREIGN KEY (jabatan_id) REFERENCES public.internal_jabatan(id)
);
CREATE TABLE public.internal_layanan (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nama character varying NOT NULL,
  kategori character varying NOT NULL,
  jumlah_sesi integer,
  harga numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_layanan_pkey PRIMARY KEY (id)
);
CREATE TABLE public.internal_jam_shift (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shift character varying NOT NULL CHECK (shift::text = ANY (ARRAY['PAGI'::character varying, 'SORE'::character varying]::text[])),
  jam_mulai time without time zone NOT NULL,
  jam_selesai time without time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_jam_shift_pkey PRIMARY KEY (id)
);
CREATE TABLE public.internal_master_jadwal (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL,
  hari character varying NOT NULL,
  shift character varying NOT NULL CHECK (shift::text = ANY (ARRAY['PAGI'::character varying, 'SORE'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_master_jadwal_pkey PRIMARY KEY (id),
  CONSTRAINT internal_master_jadwal_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id)
);
CREATE TABLE public.internal_jadwal (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL,
  tanggal date NOT NULL,
  shift character varying NOT NULL CHECK (shift::text = ANY (ARRAY['PAGI'::character varying, 'SORE'::character varying]::text[])),
  status character varying NOT NULL DEFAULT 'TERSEDIA'::character varying CHECK (status::text = ANY (ARRAY['TERSEDIA'::character varying, 'OFF'::character varying, 'CUTI'::character varying, 'MASUK'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_jadwal_pkey PRIMARY KEY (id),
  CONSTRAINT internal_jadwal_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id)
);
CREATE TABLE public.internal_cuti (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tanggal_mulai date NOT NULL,
  tanggal_selesai date NOT NULL,
  alasan text NOT NULL,
  bukti_url text,
  status character varying NOT NULL DEFAULT 'MENUNGGU'::character varying CHECK (status::text = ANY (ARRAY['MENUNGGU'::character varying, 'DISETUJUI'::character varying, 'DITOLAK'::character varying]::text[])),
  disetujui_oleh uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_cuti_pkey PRIMARY KEY (id),
  CONSTRAINT internal_cuti_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.internal_users(id),
  CONSTRAINT internal_cuti_disetujui_oleh_fkey FOREIGN KEY (disetujui_oleh) REFERENCES public.internal_users(id)
);
CREATE TABLE public.internal_target (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL,
  bulan integer NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
  tahun integer NOT NULL,
  target_terapi_awal integer NOT NULL DEFAULT 0,
  target_paket_klinik integer NOT NULL DEFAULT 0,
  target_kunjungan integer NOT NULL DEFAULT 0,
  target_homevisit_paket integer NOT NULL DEFAULT 0,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_target_pkey PRIMARY KEY (id),
  CONSTRAINT internal_target_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id)
);
CREATE TABLE public.internal_order_meta (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  kode_transaksi character varying NOT NULL UNIQUE,
  status_bayar character varying NOT NULL DEFAULT 'Belum Lunas'::character varying CHECK (status_bayar::text = ANY (ARRAY['Belum Lunas'::character varying, 'Lunas'::character varying]::text[])),
  catatan_admin text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_order_meta_pkey PRIMARY KEY (id),
  CONSTRAINT internal_order_meta_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.internal_wilayah (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kode character varying NOT NULL UNIQUE,
  nama character varying NOT NULL,
  tipe character varying NOT NULL CHECK (tipe::text = ANY (ARRAY['provinsi'::character varying, 'kabupaten'::character varying, 'kecamatan'::character varying, 'kelurahan'::character varying]::text[])),
  parent_id uuid,
  CONSTRAINT internal_wilayah_pkey PRIMARY KEY (id),
  CONSTRAINT internal_wilayah_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.internal_wilayah(id)
);
CREATE TABLE public.internal_referensi (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kunci character varying NOT NULL,
  nilai text NOT NULL,
  tipe character varying NOT NULL,
  grup character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_referensi_pkey PRIMARY KEY (id)
);
CREATE TABLE public.internal_konfigurasi (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  kunci character varying NOT NULL UNIQUE,
  nilai text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT internal_konfigurasi_pkey PRIMARY KEY (id)
);
CREATE TABLE public.branches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branches_pkey PRIMARY KEY (id)
);
CREATE TABLE public.internal_profiles (
  id uuid NOT NULL,
  full_name text NOT NULL DEFAULT ''::text,
  email text NOT NULL DEFAULT ''::text,
  phone text,
  role USER-DEFINED NOT NULL DEFAULT 'marketing'::internal_user_role,
  branch_id uuid,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT internal_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT internal_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT internal_profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.patient_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint text,
  diagnosis text,
  treatment text,
  attending_staff_id uuid,
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  visit_time time without time zone,
  package_id uuid,
  service_type text CHECK (service_type = ANY (ARRAY['TERAPI AWAL'::text, 'PAKET TERAPI'::text, 'SESI TERAPI'::text, 'TA VISIT'::text, 'SESI VISIT'::text, 'PAKET VISIT'::text, 'LAINNYA'::text])),
  shift text CHECK (shift = ANY (ARRAY['PAGI'::text, 'SORE'::text])),
  kehadiran text CHECK (kehadiran = ANY (ARRAY['HADIR'::text, 'TIDAK HADIR'::text])),
  regio text CHECK (regio = ANY (ARRAY['HEAD'::text, 'NECK'::text, 'SHOULDER'::text, 'UPPER ARM'::text, 'ELBOW'::text, 'LOWER ARM'::text, 'WRIST'::text, 'HAND'::text, 'SPINE'::text, 'CHEST'::text, 'UPPER BACK'::text, 'LOWER BACK'::text, 'ABDOMINAL'::text, 'HIP/PELVIC'::text, 'THIGH'::text, 'KNEE'::text, 'CALF'::text, 'ANKLE'::text, 'FOOT'::text, 'CNS'::text, 'PNS'::text, 'SYSTEMIC'::text, 'CARDIOVASCULAR'::text, 'PULMONAL'::text, 'PERFORMANCE'::text])),
  sumber_pasien text,
  CONSTRAINT patient_visits_pkey PRIMARY KEY (id),
  CONSTRAINT patient_visits_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT patient_visits_attending_staff_id_fkey FOREIGN KEY (attending_staff_id) REFERENCES public.internal_profiles(id),
  CONSTRAINT patient_visits_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.patient_packages(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  patient_id uuid,
  visit_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  category text NOT NULL,
  amount numeric NOT NULL,
  description text,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text])),
  rejection_reason text,
  recorded_by uuid,
  confirmed_by uuid,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  harga numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  outstanding numeric DEFAULT GREATEST(((harga - amount) - discount), (0)::numeric),
  payment_method text CHECK (payment_method = ANY (ARRAY['TUNAI'::text, 'TRANSFER BCA'::text, 'EDC BCA'::text])),
  payment_status text CHECK (payment_status = ANY (ARRAY['LUNAS'::text, 'DP'::text, 'PELUNASAN'::text])),
  penjamin text,
  fisio_id uuid,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT transactions_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.patient_visits(id),
  CONSTRAINT transactions_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.internal_profiles(id),
  CONSTRAINT transactions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.internal_profiles(id),
  CONSTRAINT transactions_fisio_id_fkey FOREIGN KEY (fisio_id) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.branch_financial_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  period_year integer NOT NULL,
  period_month integer NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  total_income numeric NOT NULL DEFAULT 0,
  total_expense numeric NOT NULL DEFAULT 0,
  net_profit numeric DEFAULT (total_income - total_expense),
  patient_count integer NOT NULL DEFAULT 0,
  visit_count integer NOT NULL DEFAULT 0,
  submitted_by uuid,
  submitted_at timestamp with time zone,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_financial_reports_pkey PRIMARY KEY (id),
  CONSTRAINT branch_financial_reports_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_financial_reports_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.internal_profiles(id),
  CONSTRAINT branch_financial_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamp with time zone,
  check_out timestamp with time zone,
  status text NOT NULL DEFAULT 'present'::text CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'leave'::text, 'sick'::text])),
  notes text,
  recorded_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT attendance_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id),
  CONSTRAINT attendance_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.leave_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  branch_id uuid,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  proof_url text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT leave_requests_pkey PRIMARY KEY (id),
  CONSTRAINT leave_requests_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id),
  CONSTRAINT leave_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  channel text CHECK (channel = ANY (ARRAY['social_media'::text, 'whatsapp'::text, 'email'::text, 'flyer'::text, 'other'::text])),
  start_date date,
  end_date date,
  budget numeric DEFAULT 0,
  actual_spend numeric DEFAULT 0,
  target_reach integer,
  actual_reach integer,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'cancelled'::text])),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT campaigns_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.user_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  target_role USER-DEFINED,
  title text NOT NULL,
  message text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.staff_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  branch_id uuid,
  bulan integer NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
  tahun integer NOT NULL,
  target_ta integer NOT NULL DEFAULT 0,
  target_paket_klinik integer NOT NULL DEFAULT 0,
  target_kunjungan integer NOT NULL DEFAULT 0,
  target_visit integer NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT staff_targets_pkey PRIMARY KEY (id),
  CONSTRAINT staff_targets_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id),
  CONSTRAINT staff_targets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT staff_targets_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  branch_id uuid,
  hari character varying NOT NULL CHECK (hari::text = ANY (ARRAY['SENIN'::character varying, 'SELASA'::character varying, 'RABU'::character varying, 'KAMIS'::character varying, 'JUMAT'::character varying, 'SABTU'::character varying, 'AHAD'::character varying]::text[])),
  shift character varying NOT NULL CHECK (shift::text = ANY (ARRAY['PAGI'::character varying, 'SORE'::character varying]::text[])),
  jam_mulai time without time zone NOT NULL DEFAULT '09:00:00'::time without time zone,
  jam_selesai time without time zone NOT NULL DEFAULT '17:00:00'::time without time zone,
  status character varying NOT NULL DEFAULT 'AKTIF'::character varying CHECK (status::text = ANY (ARRAY['AKTIF'::character varying, 'OFF'::character varying]::text[])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedules_pkey PRIMARY KEY (id),
  CONSTRAINT schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id),
  CONSTRAINT schedules_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id)
);
CREATE TABLE public.booking_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  session_number integer NOT NULL,
  tanggal date,
  jam time without time zone,
  therapist_id uuid,
  kehadiran text,
  status text NOT NULL DEFAULT 'Belum Ditangani'::text CHECK (status = ANY (ARRAY['Belum Ditangani'::text, 'Hadir'::text, 'Tidak Hadir'::text, 'Batal'::text])),
  nominal_bayar numeric DEFAULT 0,
  metode_pembayaran text,
  keterangan text,
  catatan_admin text,
  wa_order_count integer DEFAULT 0,
  wa_reminder_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT booking_sessions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_sessions_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id)
);
CREATE TABLE public.booking_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  tanggal date NOT NULL DEFAULT CURRENT_DATE,
  nominal numeric NOT NULL,
  waktu_bayar text,
  metode text,
  catatan text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT booking_payments_pkey PRIMARY KEY (id),
  CONSTRAINT booking_payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.branch_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL,
  bulan integer NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
  tahun integer NOT NULL,
  target_ta integer NOT NULL DEFAULT 0,
  target_paket_klinik integer NOT NULL DEFAULT 0,
  target_kunjungan integer NOT NULL DEFAULT 0,
  target_visit integer NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  set_by uuid,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT branch_targets_pkey PRIMARY KEY (id),
  CONSTRAINT branch_targets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT branch_targets_set_by_fkey FOREIGN KEY (set_by) REFERENCES public.internal_profiles(id),
  CONSTRAINT branch_targets_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.salary_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  base_salary numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  meal_allowance numeric NOT NULL DEFAULT 0,
  bonus_target_pct numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT salary_settings_pkey PRIMARY KEY (id),
  CONSTRAINT salary_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.employee_salaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL UNIQUE,
  base_salary numeric,
  transport_allowance numeric,
  meal_allowance numeric,
  other_allowance numeric NOT NULL DEFAULT 0,
  notes text,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT employee_salaries_pkey PRIMARY KEY (id),
  CONSTRAINT employee_salaries_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id),
  CONSTRAINT employee_salaries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.payroll_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  branch_id uuid,
  period_month integer NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year integer NOT NULL,
  base_salary numeric NOT NULL DEFAULT 0,
  transport_allowance numeric NOT NULL DEFAULT 0,
  meal_allowance numeric NOT NULL DEFAULT 0,
  other_allowance numeric NOT NULL DEFAULT 0,
  bonus_achievement numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'paid'::text])),
  confirmed_by uuid,
  confirmed_at timestamp with time zone,
  paid_at timestamp with time zone,
  transaction_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payroll_records_pkey PRIMARY KEY (id),
  CONSTRAINT payroll_records_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id),
  CONSTRAINT payroll_records_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT payroll_records_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.internal_profiles(id),
  CONSTRAINT payroll_records_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id),
  CONSTRAINT payroll_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id)
);
CREATE TABLE public.patient_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  branch_id uuid,
  package_name text NOT NULL,
  package_type text NOT NULL DEFAULT 'flexible'::text CHECK (package_type = ANY (ARRAY['fixed'::text, 'flexible'::text])),
  total_sessions integer NOT NULL DEFAULT 1 CHECK (total_sessions > 0),
  notes text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  jenis_paket text CHECK (jenis_paket = ANY (ARRAY['P1'::text, 'P2'::text])),
  mulai_paket text CHECK (mulai_paket = ANY (ARRAY['NEW'::text, 'EXT.'::text])),
  operational_status text NOT NULL DEFAULT 'ON'::text CHECK (operational_status = ANY (ARRAY['ON'::text, 'OFF'::text, 'PENDING'::text])),
  completion_status text CHECK (completion_status = ANY (ARRAY['LANJUT'::text, 'SEMBUH'::text, 'TIDAK LANJUT'::text, 'STOP'::text])),
  t1 date,
  t2 date,
  t3 date,
  t4 date,
  t5 date,
  t6 date,
  t7 date,
  t8 date,
  t9 date,
  t10 date,
  CONSTRAINT patient_packages_pkey PRIMARY KEY (id),
  CONSTRAINT patient_packages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT patient_packages_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id),
  CONSTRAINT patient_packages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id)
);
-- View: patient_packages_with_stats
-- Computes used_sessions and remaining_sessions from patient_visits.
-- See supabase/025-patient-packages-view.sql for the migration.
CREATE OR REPLACE VIEW public.patient_packages_with_stats AS
SELECT
  pp.*,
  COALESCE(vc.used_sessions, 0)                          AS used_sessions,
  pp.total_sessions - COALESCE(vc.used_sessions, 0)      AS remaining_sessions
FROM public.patient_packages pp
LEFT JOIN (
  SELECT package_id, COUNT(*) AS used_sessions
  FROM public.patient_visits
  WHERE status != 'cancelled'
    AND package_id IS NOT NULL
  GROUP BY package_id
) vc ON pp.id = vc.package_id;