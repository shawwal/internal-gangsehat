--
-- PostgreSQL database dump
--

\restrict 0Jf5zldz7BEb84yy0dPhHZYNwzID0AQUMAxzqg0DrzwZFtM4ohnk7uchMP1mirQ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA public; (already exists on Supabase projects)


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: booking_status_new; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status_new AS ENUM (
    'waiting_confirmation',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
);


--
-- Name: internal_user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.internal_user_role AS ENUM (
    'director',
    'finance',
    'hr',
    'marketing',
    'staff',
    'therapist',
    'manager',
    'admin',
    'non-staff'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'therapist',
    'patient'
);


--
-- Name: generate_trx_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_trx_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  seq int;
BEGIN
  SELECT COALESCE(MAX(
    (regexp_match(kode_transaksi, 'TRX/\d{4}/\d{2}/(\d+)'))[1]::int
  ), 0) + 1
  INTO seq
  FROM internal_order_meta
  WHERE kode_transaksi LIKE 'TRX/' || EXTRACT(YEAR FROM now()) || '/' ||
        LPAD(EXTRACT(MONTH FROM now())::text, 2, '0') || '/%';

  NEW.kode_transaksi := 'TRX/' ||
    EXTRACT(YEAR FROM now()) || '/' ||
    LPAD(EXTRACT(MONTH FROM now())::text, 2, '0') || '/' ||
    LPAD(seq::text, 4, '0');
  RETURN NEW;
END;
$$;


--
-- Name: get_my_branch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_branch() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT branch_id FROM public.internal_profiles WHERE id = auth.uid();
$$;


--
-- Name: get_my_internal_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_internal_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT role::text FROM public.internal_profiles WHERE id = auth.uid();
$$;


--
-- Name: handle_new_internal_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_internal_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.internal_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(COALESCE(NEW.email, 'user@x'), '@', 1)
    ),
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;


--
-- Name: next_order_seq(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.next_order_seq(p_year integer, p_month integer) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  INSERT INTO order_sequences (year, month, last_seq)
  VALUES (p_year, p_month, 1)
  ON CONFLICT (year, month)
  DO UPDATE SET last_seq = order_sequences.last_seq + 1
  RETURNING last_seq;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: update_therapist_ratings(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_therapist_ratings() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE therapists
  SET
    average_rating = (
      SELECT AVG(rating) FROM therapist_ratings WHERE therapist_id = NEW.therapist_id
    ),
    total_reviews = (
      SELECT COUNT(*) FROM therapist_ratings WHERE therapist_id = NEW.therapist_id
    ),
    updated_at = NOW()
  WHERE id = NEW.therapist_id;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    check_in timestamp with time zone,
    check_out timestamp with time zone,
    status text DEFAULT 'present'::text NOT NULL,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT attendance_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'late'::text, 'leave'::text, 'sick'::text])))
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bank_name character varying(100) NOT NULL,
    account_number character varying(50) NOT NULL,
    account_name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_id character varying(255) NOT NULL,
    title_en character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    excerpt_id text NOT NULL,
    excerpt_en text NOT NULL,
    content_id text NOT NULL,
    content_en text NOT NULL,
    author character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    image_url text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    meta_title_id character varying(255),
    meta_description_id text,
    meta_title_en character varying(255),
    meta_description_en text
);


--
-- Name: booking_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    changed_by_user_id uuid,
    changed_by_role text,
    cancellation_reason text,
    therapist_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: booking_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    tanggal date DEFAULT CURRENT_DATE NOT NULL,
    nominal numeric NOT NULL,
    waktu_bayar text,
    metode text,
    catatan text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: booking_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    session_number integer NOT NULL,
    tanggal date,
    jam time without time zone,
    therapist_id uuid,
    kehadiran text,
    status text DEFAULT 'Belum Ditangani'::text NOT NULL,
    nominal_bayar numeric DEFAULT 0,
    metode_pembayaran text,
    keterangan text,
    catatan_admin text,
    wa_order_count integer DEFAULT 0,
    wa_reminder_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT booking_sessions_status_check CHECK ((status = ANY (ARRAY['Belum Ditangani'::text, 'Hadir'::text, 'Tidak Hadir'::text, 'Batal'::text])))
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid,
    therapist_id uuid,
    service_type text NOT NULL,
    scheduled_date date NOT NULL,
    scheduled_time text NOT NULL,
    duration_minutes integer DEFAULT 60 NOT NULL,
    encrypted_address text,
    location_notes text,
    estimated_price numeric(12,2),
    patient_notes text,
    therapist_notes text,
    admin_notes text,
    confirmed_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    guest_name character varying(255),
    guest_email character varying(255),
    guest_phone character varying(20),
    status text DEFAULT 'waiting_confirmation'::text,
    city character varying(100),
    discount_percentage numeric(5,2),
    discounted_price numeric(10,2),
    payment_method text,
    payment_receipt_url text,
    bank_name text,
    bank_account_number text,
    bank_account_name text,
    rating integer,
    feedback text,
    guest_age integer,
    guest_gender text,
    is_for_other boolean DEFAULT false,
    location_lat double precision,
    location_lng double precision,
    distance_fee integer DEFAULT 0 NOT NULL,
    parent_name text,
    parent_job text,
    CONSTRAINT bookings_guest_gender_check CHECK ((guest_gender = ANY (ARRAY['male'::text, 'female'::text]))),
    CONSTRAINT bookings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: COLUMN bookings.rating; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.rating IS 'Patient rating of therapist (1-5 stars)';


--
-- Name: COLUMN bookings.feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.feedback IS 'Patient feedback/review text for the therapist';


--
-- Name: COLUMN bookings.parent_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.parent_name IS 'Name of parent/guardian (used for griya-anak service type)';


--
-- Name: COLUMN bookings.parent_job; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.parent_job IS 'Job/occupation of parent/guardian (used for griya-anak service type)';


--
-- Name: branch_financial_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_financial_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    period_year integer NOT NULL,
    period_month integer NOT NULL,
    total_income numeric DEFAULT 0 NOT NULL,
    total_expense numeric DEFAULT 0 NOT NULL,
    net_profit numeric GENERATED ALWAYS AS ((total_income - total_expense)) STORED,
    patient_count integer DEFAULT 0 NOT NULL,
    visit_count integer DEFAULT 0 NOT NULL,
    submitted_by uuid,
    submitted_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT branch_financial_reports_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12))),
    CONSTRAINT branch_financial_reports_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: branch_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    bulan integer NOT NULL,
    tahun integer NOT NULL,
    target_ta integer DEFAULT 0 NOT NULL,
    target_paket_klinik integer DEFAULT 0 NOT NULL,
    target_kunjungan integer DEFAULT 0 NOT NULL,
    target_visit integer DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    set_by uuid,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT branch_targets_bulan_check CHECK (((bulan >= 1) AND (bulan <= 12))),
    CONSTRAINT branch_targets_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    phone text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    channel text,
    start_date date,
    end_date date,
    budget numeric DEFAULT 0,
    actual_spend numeric DEFAULT 0,
    target_reach integer,
    actual_reach integer,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT campaigns_channel_check CHECK ((channel = ANY (ARRAY['social_media'::text, 'whatsapp'::text, 'email'::text, 'flyer'::text, 'other'::text]))),
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: clinic_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    setting_key text NOT NULL,
    setting_value text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: diagnoses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnoses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dp_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dp_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    dp_percentage numeric(5,2) DEFAULT 50.00 NOT NULL,
    transfer_enabled boolean DEFAULT true NOT NULL,
    qris_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_salaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_salaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    base_salary numeric,
    transport_allowance numeric,
    meal_allowance numeric,
    other_allowance numeric DEFAULT 0 NOT NULL,
    notes text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: gallery_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gallery_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_id character varying(255) NOT NULL,
    title_en character varying(255) NOT NULL,
    description_id text NOT NULL,
    description_en text NOT NULL,
    video_id character varying(100) NOT NULL,
    thumbnail_url text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: homepage_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homepage_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title_id text NOT NULL,
    title_en text NOT NULL,
    description_id text DEFAULT ''::text NOT NULL,
    description_en text DEFAULT ''::text NOT NULL,
    icon text DEFAULT '💪'::text NOT NULL,
    image_url text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    booking_type text DEFAULT 'fisioterapi'::text NOT NULL
);


--
-- Name: internal_cuti; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_cuti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tanggal_mulai date NOT NULL,
    tanggal_selesai date NOT NULL,
    alasan text NOT NULL,
    bukti_url text,
    status character varying(10) DEFAULT 'MENUNGGU'::character varying NOT NULL,
    disetujui_oleh uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT internal_cuti_status_check CHECK (((status)::text = ANY ((ARRAY['MENUNGGU'::character varying, 'DISETUJUI'::character varying, 'DITOLAK'::character varying])::text[])))
);


--
-- Name: internal_jabatan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_jabatan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nama character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: internal_jadwal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_jadwal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    therapist_id uuid NOT NULL,
    tanggal date NOT NULL,
    shift character varying(10) NOT NULL,
    status character varying(10) DEFAULT 'TERSEDIA'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT internal_jadwal_shift_check CHECK (((shift)::text = ANY ((ARRAY['PAGI'::character varying, 'SORE'::character varying])::text[]))),
    CONSTRAINT internal_jadwal_status_check CHECK (((status)::text = ANY ((ARRAY['TERSEDIA'::character varying, 'OFF'::character varying, 'CUTI'::character varying, 'MASUK'::character varying])::text[])))
);


--
-- Name: internal_jam_shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_jam_shift (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shift character varying(10) NOT NULL,
    jam_mulai time without time zone NOT NULL,
    jam_selesai time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT internal_jam_shift_shift_check CHECK (((shift)::text = ANY ((ARRAY['PAGI'::character varying, 'SORE'::character varying])::text[])))
);


--
-- Name: internal_konfigurasi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_konfigurasi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kunci character varying(100) NOT NULL,
    nilai text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: internal_layanan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_layanan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nama character varying(200) NOT NULL,
    kategori character varying(100) NOT NULL,
    jumlah_sesi integer,
    harga numeric(12,0) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    branch_id uuid NOT NULL
);


--
-- Name: internal_master_jadwal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_master_jadwal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    therapist_id uuid NOT NULL,
    hari character varying(10) NOT NULL,
    shift character varying(10) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT internal_master_jadwal_shift_check CHECK (((shift)::text = ANY ((ARRAY['PAGI'::character varying, 'SORE'::character varying])::text[])))
);


--
-- Name: internal_order_meta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_order_meta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    kode_transaksi character varying(20) NOT NULL,
    status_bayar character varying(20) DEFAULT 'Belum Lunas'::character varying NOT NULL,
    catatan_admin text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT internal_order_meta_status_bayar_check CHECK (((status_bayar)::text = ANY ((ARRAY['Belum Lunas'::character varying, 'Lunas'::character varying])::text[])))
);


--
-- Name: internal_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_profiles (
    id uuid NOT NULL,
    full_name text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    phone text,
    role public.internal_user_role DEFAULT 'non-staff'::public.internal_user_role NOT NULL,
    branch_id uuid,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    nickname text,
    gender text,
    CONSTRAINT internal_profiles_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text])))
);


--
-- Name: internal_referensi; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_referensi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kunci character varying(100) NOT NULL,
    nilai text NOT NULL,
    tipe character varying(50) NOT NULL,
    grup character varying(50),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: internal_target; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_target (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    therapist_id uuid NOT NULL,
    bulan integer NOT NULL,
    tahun integer NOT NULL,
    target_terapi_awal integer DEFAULT 0 NOT NULL,
    target_paket_klinik integer DEFAULT 0 NOT NULL,
    target_kunjungan integer DEFAULT 0 NOT NULL,
    target_homevisit_paket integer DEFAULT 0 NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT internal_target_bulan_check CHECK (((bulan >= 1) AND (bulan <= 12)))
);


--
-- Name: internal_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    jabatan_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: internal_wilayah; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_wilayah (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kode character varying(20) NOT NULL,
    nama character varying(200) NOT NULL,
    tipe character varying(20) NOT NULL,
    parent_id uuid,
    CONSTRAINT internal_wilayah_tipe_check CHECK (((tipe)::text = ANY ((ARRAY['provinsi'::character varying, 'kabupaten'::character varying, 'kecamatan'::character varying, 'kelurahan'::character varying])::text[])))
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    branch_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    proof_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: member_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_type (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: member_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.member_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: member_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.member_type_id_seq OWNED BY public.member_type.id;


--
-- Name: order_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_sequences (
    year integer NOT NULL,
    month integer NOT NULL,
    last_seq integer DEFAULT 0 NOT NULL,
    CONSTRAINT order_sequences_month_check CHECK (((month >= 1) AND (month <= 12)))
);


--
-- Name: patient_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    branch_id uuid,
    package_name text NOT NULL,
    package_type text DEFAULT 'flexible'::text NOT NULL,
    total_sessions integer DEFAULT 1 NOT NULL,
    notes text,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    jenis_paket text,
    mulai_paket text,
    operational_status text DEFAULT 'ON'::text NOT NULL,
    completion_status text,
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
    legacy_used_sessions integer DEFAULT 0 NOT NULL,
    order_id text,
    category text,
    purchased_at date DEFAULT CURRENT_DATE NOT NULL,
    CONSTRAINT patient_packages_category_check CHECK ((category = ANY (ARRAY['PAKET KLINIK'::text, 'PAKET VISIT'::text]))),
    CONSTRAINT patient_packages_completion_status_check CHECK ((completion_status = ANY (ARRAY['LANJUT'::text, 'SEMBUH'::text, 'TIDAK LANJUT'::text, 'STOP'::text]))),
    CONSTRAINT patient_packages_jenis_paket_check CHECK ((jenis_paket = ANY (ARRAY['P1'::text, 'P2'::text]))),
    CONSTRAINT patient_packages_mulai_paket_check CHECK ((mulai_paket = ANY (ARRAY['NEW'::text, 'EXT.'::text]))),
    CONSTRAINT patient_packages_operational_status_check CHECK ((operational_status = ANY (ARRAY['ON'::text, 'OFF'::text, 'PENDING'::text]))),
    CONSTRAINT patient_packages_package_type_check CHECK ((package_type = ANY (ARRAY['fixed'::text, 'flexible'::text]))),
    CONSTRAINT patient_packages_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT patient_packages_total_sessions_check CHECK ((total_sessions > 0))
);


--
-- Name: patient_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    visit_date date DEFAULT CURRENT_DATE NOT NULL,
    chief_complaint text,
    diagnosis text,
    treatment text,
    attending_staff_id uuid,
    status text DEFAULT 'scheduled'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    visit_time time without time zone,
    package_id uuid,
    service_type text,
    shift text,
    kehadiran text,
    regio text,
    sumber_pasien text,
    order_id text,
    CONSTRAINT patient_visits_kehadiran_check CHECK ((kehadiran = ANY (ARRAY['HADIR'::text, 'TIDAK HADIR'::text]))),
    CONSTRAINT patient_visits_regio_check CHECK ((regio = ANY (ARRAY['HEAD'::text, 'NECK'::text, 'SHOULDER'::text, 'UPPER ARM'::text, 'ELBOW'::text, 'LOWER ARM'::text, 'WRIST'::text, 'HAND'::text, 'SPINE'::text, 'CHEST'::text, 'UPPER BACK'::text, 'LOWER BACK'::text, 'ABDOMINAL'::text, 'HIP/PELVIC'::text, 'THIGH'::text, 'KNEE'::text, 'CALF'::text, 'ANKLE'::text, 'FOOT'::text, 'CNS'::text, 'PNS'::text, 'SYSTEMIC'::text, 'CARDIOVASCULAR'::text, 'PULMONAL'::text, 'PERFORMANCE'::text]))),
    CONSTRAINT patient_visits_service_type_check CHECK ((service_type = ANY (ARRAY['TERAPI AWAL'::text, 'PAKET TERAPI'::text, 'SESI TERAPI'::text, 'TA VISIT'::text, 'SESI VISIT'::text, 'PAKET VISIT'::text, 'LAINNYA'::text]))),
    CONSTRAINT patient_visits_shift_check CHECK ((shift = ANY (ARRAY['PAGI'::text, 'SORE'::text]))),
    CONSTRAINT patient_visits_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])))
);


--
-- Name: patient_packages_with_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.patient_packages_with_stats AS
 SELECT pp.id,
    pp.patient_id,
    pp.branch_id,
    pp.package_name,
    pp.package_type,
    pp.total_sessions,
    pp.notes,
    pp.status,
    pp.created_by,
    pp.created_at,
    pp.updated_at,
    pp.jenis_paket,
    pp.mulai_paket,
    pp.operational_status,
    pp.completion_status,
    pp.t1,
    pp.t2,
    pp.t3,
    pp.t4,
    pp.t5,
    pp.t6,
    pp.t7,
    pp.t8,
    pp.t9,
    pp.t10,
    pp.legacy_used_sessions,
    (pp.legacy_used_sessions + COALESCE(vc.used_sessions, (0)::bigint)) AS used_sessions,
    (pp.total_sessions - (pp.legacy_used_sessions + COALESCE(vc.used_sessions, (0)::bigint))) AS remaining_sessions
   FROM (public.patient_packages pp
     LEFT JOIN ( SELECT patient_visits.package_id,
            count(*) AS used_sessions
           FROM public.patient_visits
          WHERE ((patient_visits.status <> 'cancelled'::text) AND (patient_visits.package_id IS NOT NULL) AND (patient_visits.kehadiran <> 'TIDAK HADIR'::text))
          GROUP BY patient_visits.package_id) vc ON ((pp.id = vc.package_id)));


--
-- Name: patient_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    used_points integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    encrypted_name text NOT NULL,
    encrypted_phone text NOT NULL,
    encrypted_address text,
    encrypted_id_number text,
    encrypted_birth_date text,
    encrypted_emergency_contact text,
    gender text,
    blood_type text,
    allergies text[],
    medical_notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
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
    name_normalized text,
    keluhan text,
    CONSTRAINT patients_blood_type_check CHECK ((blood_type = ANY (ARRAY['A'::text, 'B'::text, 'AB'::text, 'O'::text, 'unknown'::text]))),
    CONSTRAINT patients_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'other'::text])))
);


--
-- Name: payroll_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    branch_id uuid,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    base_salary numeric DEFAULT 0 NOT NULL,
    transport_allowance numeric DEFAULT 0 NOT NULL,
    meal_allowance numeric DEFAULT 0 NOT NULL,
    other_allowance numeric DEFAULT 0 NOT NULL,
    bonus_achievement numeric DEFAULT 0 NOT NULL,
    deductions numeric DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'draft'::text NOT NULL,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    paid_at timestamp with time zone,
    transaction_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payroll_records_period_month_check CHECK (((period_month >= 1) AND (period_month <= 12))),
    CONSTRAINT payroll_records_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'paid'::text])))
);


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    package_id uuid,
    points_change integer NOT NULL,
    type character varying(20) NOT NULL,
    booking_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT point_transactions_type_check CHECK (((type)::text = ANY ((ARRAY['purchase'::character varying, 'redeem'::character varying, 'adjustment'::character varying])::text[])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    phone text,
    avatar_url text,
    role public.user_role DEFAULT 'patient'::public.user_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    star_level integer DEFAULT 0 NOT NULL,
    CONSTRAINT star_level_range CHECK (((star_level >= 0) AND (star_level <= 3)))
);


--
-- Name: resume_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resume_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visit_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    token text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: salary_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salary_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role text NOT NULL,
    base_salary numeric DEFAULT 0 NOT NULL,
    transport_allowance numeric DEFAULT 0 NOT NULL,
    meal_allowance numeric DEFAULT 0 NOT NULL,
    bonus_target_pct numeric DEFAULT 0 NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: schedule_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    branch_id uuid,
    start_date date NOT NULL,
    end_date date NOT NULL,
    hari character varying NOT NULL,
    shift character varying NOT NULL,
    jam_mulai time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    jam_selesai time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    reason text,
    created_by uuid,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT end_after_start CHECK ((end_date >= start_date)),
    CONSTRAINT schedule_overrides_hari_check CHECK (((hari)::text = ANY ((ARRAY['SENIN'::character varying, 'SELASA'::character varying, 'RABU'::character varying, 'KAMIS'::character varying, 'JUMAT'::character varying, 'SABTU'::character varying, 'AHAD'::character varying])::text[]))),
    CONSTRAINT schedule_overrides_shift_check CHECK (((shift)::text = ANY ((ARRAY['PAGI'::character varying, 'SORE'::character varying])::text[]))),
    CONSTRAINT schedule_overrides_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: schedule_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shift text NOT NULL,
    slot_time text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_slots_shift_check CHECK ((shift = ANY (ARRAY['PAGI'::text, 'SORE'::text])))
);


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    branch_id uuid,
    hari character varying(10) NOT NULL,
    shift character varying(10) NOT NULL,
    jam_mulai time without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    jam_selesai time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    status character varying(10) DEFAULT 'AKTIF'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    week_group character varying DEFAULT 'SEMUA'::character varying NOT NULL,
    CONSTRAINT schedules_hari_check CHECK (((hari)::text = ANY ((ARRAY['SENIN'::character varying, 'SELASA'::character varying, 'RABU'::character varying, 'KAMIS'::character varying, 'JUMAT'::character varying, 'SABTU'::character varying, 'AHAD'::character varying])::text[]))),
    CONSTRAINT schedules_shift_check CHECK (((shift)::text = ANY ((ARRAY['PAGI'::character varying, 'SORE'::character varying])::text[]))),
    CONSTRAINT schedules_status_check CHECK (((status)::text = ANY ((ARRAY['AKTIF'::character varying, 'OFF'::character varying])::text[]))),
    CONSTRAINT schedules_week_group_check CHECK (((week_group)::text = ANY ((ARRAY['SEMUA'::character varying, 'MINGGU_1'::character varying, 'MINGGU_2'::character varying])::text[])))
);


--
-- Name: service_areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    city text NOT NULL,
    address text,
    phone text,
    hours text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    map_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: service_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    price numeric(12,2) NOT NULL,
    duration_minutes integer DEFAULT 60 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    discount_percentage numeric(5,2) DEFAULT 0,
    discount_until date,
    category text DEFAULT 'fisioterapi'::text NOT NULL,
    image_url text
);


--
-- Name: session_note_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_note_settings (
    id integer DEFAULT 1 NOT NULL,
    form_mode text DEFAULT 'single_step'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    assessment_form_mode text DEFAULT 'single_step'::text NOT NULL,
    CONSTRAINT session_note_settings_assessment_form_mode_check CHECK ((assessment_form_mode = ANY (ARRAY['single_step'::text, 'multi_step'::text]))),
    CONSTRAINT session_note_settings_form_mode_check CHECK ((form_mode = ANY (ARRAY['single_step'::text, 'multi_step'::text]))),
    CONSTRAINT session_note_settings_singleton CHECK ((id = 1))
);


--
-- Name: session_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visit_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pain_scale smallint,
    symptom_trend text,
    subjective_notes text,
    objective_findings text,
    clinical_impression text,
    treatments_performed text[] DEFAULT '{}'::text[] NOT NULL,
    hep_given text,
    next_plan text,
    treatment_notes text,
    CONSTRAINT session_notes_pain_scale_check CHECK (((pain_scale >= 0) AND (pain_scale <= 10))),
    CONSTRAINT session_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'completed'::text]))),
    CONSTRAINT session_notes_symptom_trend_check CHECK ((symptom_trend = ANY (ARRAY['IMPROVING'::text, 'SAME'::text, 'WORSENING'::text])))
);


--
-- Name: session_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    points_count integer NOT NULL,
    price numeric(12,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    card_type integer,
    CONSTRAINT session_packages_points_count_check CHECK ((points_count > 0))
);


--
-- Name: shift_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_patterns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    code text NOT NULL,
    name text,
    senin text NOT NULL,
    selasa text NOT NULL,
    rabu text NOT NULL,
    kamis text NOT NULL,
    jumat text NOT NULL,
    sabtu text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shift_patterns_code_check CHECK ((code = ANY (ARRAY['X'::text, 'Y'::text]))),
    CONSTRAINT shift_patterns_jumat_check CHECK ((jumat = ANY (ARRAY['PAGI'::text, 'SORE'::text, 'OFF'::text]))),
    CONSTRAINT shift_patterns_kamis_check CHECK ((kamis = ANY (ARRAY['PAGI'::text, 'SORE'::text, 'OFF'::text]))),
    CONSTRAINT shift_patterns_rabu_check CHECK ((rabu = ANY (ARRAY['PAGI'::text, 'SORE'::text, 'OFF'::text]))),
    CONSTRAINT shift_patterns_sabtu_check CHECK ((sabtu = ANY (ARRAY['PAGI'::text, 'SORE'::text, 'OFF'::text]))),
    CONSTRAINT shift_patterns_selasa_check CHECK ((selasa = ANY (ARRAY['PAGI'::text, 'SORE'::text, 'OFF'::text]))),
    CONSTRAINT shift_patterns_senin_check CHECK ((senin = ANY (ARRAY['PAGI'::text, 'SORE'::text, 'OFF'::text])))
);


--
-- Name: shift_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    effective_start_date date DEFAULT CURRENT_DATE NOT NULL,
    effective_end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT end_after_start CHECK (((effective_end_date IS NULL) OR (effective_end_date >= effective_start_date)))
);


--
-- Name: shift_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    name text NOT NULL,
    pola_x_id uuid NOT NULL,
    pola_y_id uuid NOT NULL,
    anchor_date date NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shift_teams_name_check CHECK ((name = ANY (ARRAY['A'::text, 'B'::text])))
);


--
-- Name: staff_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    branch_id uuid,
    bulan integer NOT NULL,
    tahun integer NOT NULL,
    target_ta integer DEFAULT 0 NOT NULL,
    target_paket_klinik integer DEFAULT 0 NOT NULL,
    target_kunjungan integer DEFAULT 0 NOT NULL,
    target_visit integer DEFAULT 0 NOT NULL,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT staff_targets_bulan_check CHECK (((bulan >= 1) AND (bulan <= 12))),
    CONSTRAINT staff_targets_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: success_stories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.success_stories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_name character varying(100) NOT NULL,
    condition character varying(200) NOT NULL,
    quote text NOT NULL,
    image_url text,
    display_order integer DEFAULT 0 NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: terapi_awal_assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terapi_awal_assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visit_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    history_moi text,
    aggravating_factors text,
    easing_factors text,
    red_flags text[] DEFAULT '{}'::text[] NOT NULL,
    observation_gait_posture text,
    rom_active_passive text,
    muscle_strength_mmt text,
    special_ortho_tests text,
    palpation text,
    dermatomes_sensory text,
    myotomes_motor text,
    reflexes_neural_tension text,
    prom_used text,
    prom_baseline_score numeric,
    functional_metric_test text,
    functional_metric_baseline_value text,
    npips text,
    diagnosis_hypothesis text,
    short_term_goals text,
    long_term_goals text,
    treatment_plan_today text,
    pain_site text,
    pain_onset text,
    pain_character text,
    pain_radiation text,
    pain_associated_symptoms text[] DEFAULT '{}'::text[] NOT NULL,
    pain_time_course text,
    pain_severity_vas smallint,
    joint_exam_rows jsonb DEFAULT '[]'::jsonb NOT NULL,
    dermatomes_status text,
    dermatomes_notes text,
    myotomes_status text,
    myotomes_notes text,
    reflexes_status text,
    reflexes_notes text,
    riwayat_cedera_pengobatan text,
    observation_findings text[] DEFAULT '{}'::text[] NOT NULL,
    outcome_measure_notes text,
    diagnosis_primer text,
    diagnosis_sekunder text,
    icf_body_functions_notes text,
    icf_body_functions_severity text,
    icf_activity_notes text,
    icf_activity_severity text,
    icf_participation_notes text,
    icf_participation_severity text,
    icf_contextual_notes text,
    icf_contextual_severity text,
    CONSTRAINT terapi_awal_assessments_dermatomes_status_check CHECK ((dermatomes_status = ANY (ARRAY['Intact'::text, 'Impaired'::text, 'Absent'::text, 'NotTested'::text]))),
    CONSTRAINT terapi_awal_assessments_myotomes_status_check CHECK ((myotomes_status = ANY (ARRAY['Intact'::text, 'Impaired'::text, 'NotTested'::text]))),
    CONSTRAINT terapi_awal_assessments_pain_character_check CHECK ((pain_character = ANY (ARRAY['Sharp'::text, 'Dull'::text, 'Burning'::text, 'Shooting'::text, 'Throbbing'::text, 'Other'::text, 'TidakDiperiksa'::text]))),
    CONSTRAINT terapi_awal_assessments_pain_onset_check CHECK ((pain_onset = ANY (ARRAY['Sudden'::text, 'Gradual'::text, 'Insidious'::text, 'TidakDiperiksa'::text]))),
    CONSTRAINT terapi_awal_assessments_pain_radiation_check CHECK ((pain_radiation = ANY (ARRAY['None'::text, 'DownArm'::text, 'DownLeg'::text, 'Other'::text, 'TidakDiperiksa'::text]))),
    CONSTRAINT terapi_awal_assessments_pain_severity_vas_check CHECK (((pain_severity_vas >= 0) AND (pain_severity_vas <= 10))),
    CONSTRAINT terapi_awal_assessments_pain_time_course_check CHECK ((pain_time_course = ANY (ARRAY['Constant'::text, 'Intermittent'::text, 'WorseAM'::text, 'WorsePM'::text, 'NightPain'::text, 'TidakDiperiksa'::text]))),
    CONSTRAINT terapi_awal_assessments_prom_used_check CHECK ((prom_used = ANY (ARRAY['LEFS'::text, 'SPADI'::text, 'ODI'::text, 'Other'::text]))),
    CONSTRAINT terapi_awal_assessments_reflexes_status_check CHECK ((reflexes_status = ANY (ARRAY['Normal'::text, 'Hyporeflexive'::text, 'Hyperreflexive'::text, 'Absent'::text, 'NotTested'::text]))),
    CONSTRAINT terapi_awal_assessments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'completed'::text])))
);


--
-- Name: therapist_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapist_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    therapist_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    rating integer NOT NULL,
    feedback text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT therapist_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: therapists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.therapists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    specializations text[] DEFAULT '{}'::text[] NOT NULL,
    certifications text[] DEFAULT '{}'::text[],
    license_number text,
    experience_years integer DEFAULT 0,
    bio text,
    is_available boolean DEFAULT true NOT NULL,
    working_hours jsonb DEFAULT '{"friday": {"end": "17:00", "start": "09:00"}, "monday": {"end": "17:00", "start": "09:00"}, "tuesday": {"end": "17:00", "start": "09:00"}, "thursday": {"end": "17:00", "start": "09:00"}, "wednesday": {"end": "17:00", "start": "09:00"}}'::jsonb,
    service_areas text[] DEFAULT '{}'::text[],
    current_location jsonb,
    average_rating numeric(3,2) DEFAULT 0.00,
    total_reviews integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    branch_id uuid NOT NULL,
    patient_id uuid,
    visit_id uuid,
    type text NOT NULL,
    category text NOT NULL,
    amount numeric NOT NULL,
    description text,
    receipt_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    rejection_reason text,
    recorded_by uuid,
    confirmed_by uuid,
    transaction_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    harga numeric DEFAULT 0 NOT NULL,
    discount numeric DEFAULT 0 NOT NULL,
    outstanding numeric GENERATED ALWAYS AS (GREATEST(((harga - amount) - discount), (0)::numeric)) STORED,
    payment_method text,
    payment_status text,
    penjamin text,
    fisio_id uuid,
    order_id text,
    CONSTRAINT transactions_payment_method_check CHECK ((payment_method = ANY (ARRAY['TUNAI'::text, 'TRANSFER BCA'::text, 'EDC BCA'::text]))),
    CONSTRAINT transactions_payment_status_check CHECK ((payment_status = ANY (ARRAY['LUNAS'::text, 'DP'::text, 'PELUNASAN'::text]))),
    CONSTRAINT transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'rejected'::text]))),
    CONSTRAINT transactions_type_check CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
);


--
-- Name: treatment_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.treatment_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
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
    attachments text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    guest_name character varying(255),
    guest_email character varying(255),
    guest_phone character varying(50),
    CONSTRAINT check_patient_or_guest CHECK (((patient_id IS NOT NULL) OR ((patient_id IS NULL) AND (guest_name IS NOT NULL))))
);


--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    target_role public.internal_user_role,
    title text NOT NULL,
    message text,
    link text,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: member_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_type ALTER COLUMN id SET DEFAULT nextval('public.member_type_id_seq'::regclass);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_staff_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_staff_id_date_key UNIQUE (staff_id, date);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: booking_history booking_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_history
    ADD CONSTRAINT booking_history_pkey PRIMARY KEY (id);


--
-- Name: booking_payments booking_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_payments
    ADD CONSTRAINT booking_payments_pkey PRIMARY KEY (id);


--
-- Name: booking_sessions booking_sessions_booking_id_session_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_sessions
    ADD CONSTRAINT booking_sessions_booking_id_session_number_key UNIQUE (booking_id, session_number);


--
-- Name: booking_sessions booking_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_sessions
    ADD CONSTRAINT booking_sessions_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: branch_financial_reports branch_financial_reports_branch_id_period_year_period_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_financial_reports
    ADD CONSTRAINT branch_financial_reports_branch_id_period_year_period_month_key UNIQUE (branch_id, period_year, period_month);


--
-- Name: branch_financial_reports branch_financial_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_financial_reports
    ADD CONSTRAINT branch_financial_reports_pkey PRIMARY KEY (id);


--
-- Name: branch_targets branch_targets_branch_id_bulan_tahun_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_targets
    ADD CONSTRAINT branch_targets_branch_id_bulan_tahun_key UNIQUE (branch_id, bulan, tahun);


--
-- Name: branch_targets branch_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_targets
    ADD CONSTRAINT branch_targets_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: clinic_settings clinic_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_settings
    ADD CONSTRAINT clinic_settings_pkey PRIMARY KEY (id);


--
-- Name: clinic_settings clinic_settings_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_settings
    ADD CONSTRAINT clinic_settings_setting_key_key UNIQUE (setting_key);


--
-- Name: diagnoses diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (id);


--
-- Name: dp_settings dp_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dp_settings
    ADD CONSTRAINT dp_settings_pkey PRIMARY KEY (id);


--
-- Name: employee_salaries employee_salaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salaries
    ADD CONSTRAINT employee_salaries_pkey PRIMARY KEY (id);


--
-- Name: employee_salaries employee_salaries_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salaries
    ADD CONSTRAINT employee_salaries_staff_id_key UNIQUE (staff_id);


--
-- Name: gallery_videos gallery_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gallery_videos
    ADD CONSTRAINT gallery_videos_pkey PRIMARY KEY (id);


--
-- Name: homepage_services homepage_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_services
    ADD CONSTRAINT homepage_services_pkey PRIMARY KEY (id);


--
-- Name: internal_cuti internal_cuti_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_cuti
    ADD CONSTRAINT internal_cuti_pkey PRIMARY KEY (id);


--
-- Name: internal_jabatan internal_jabatan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_jabatan
    ADD CONSTRAINT internal_jabatan_pkey PRIMARY KEY (id);


--
-- Name: internal_jadwal internal_jadwal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_jadwal
    ADD CONSTRAINT internal_jadwal_pkey PRIMARY KEY (id);


--
-- Name: internal_jadwal internal_jadwal_therapist_id_tanggal_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_jadwal
    ADD CONSTRAINT internal_jadwal_therapist_id_tanggal_shift_key UNIQUE (therapist_id, tanggal, shift);


--
-- Name: internal_jam_shift internal_jam_shift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_jam_shift
    ADD CONSTRAINT internal_jam_shift_pkey PRIMARY KEY (id);


--
-- Name: internal_konfigurasi internal_konfigurasi_kunci_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_konfigurasi
    ADD CONSTRAINT internal_konfigurasi_kunci_key UNIQUE (kunci);


--
-- Name: internal_konfigurasi internal_konfigurasi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_konfigurasi
    ADD CONSTRAINT internal_konfigurasi_pkey PRIMARY KEY (id);


--
-- Name: internal_layanan internal_layanan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_layanan
    ADD CONSTRAINT internal_layanan_pkey PRIMARY KEY (id);


--
-- Name: internal_master_jadwal internal_master_jadwal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_master_jadwal
    ADD CONSTRAINT internal_master_jadwal_pkey PRIMARY KEY (id);


--
-- Name: internal_master_jadwal internal_master_jadwal_therapist_id_hari_shift_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_master_jadwal
    ADD CONSTRAINT internal_master_jadwal_therapist_id_hari_shift_key UNIQUE (therapist_id, hari, shift);


--
-- Name: internal_order_meta internal_order_meta_kode_transaksi_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_order_meta
    ADD CONSTRAINT internal_order_meta_kode_transaksi_key UNIQUE (kode_transaksi);


--
-- Name: internal_order_meta internal_order_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_order_meta
    ADD CONSTRAINT internal_order_meta_pkey PRIMARY KEY (id);


--
-- Name: internal_profiles internal_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_profiles
    ADD CONSTRAINT internal_profiles_pkey PRIMARY KEY (id);


--
-- Name: internal_referensi internal_referensi_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_referensi
    ADD CONSTRAINT internal_referensi_pkey PRIMARY KEY (id);


--
-- Name: internal_target internal_target_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_target
    ADD CONSTRAINT internal_target_pkey PRIMARY KEY (id);


--
-- Name: internal_target internal_target_therapist_id_bulan_tahun_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_target
    ADD CONSTRAINT internal_target_therapist_id_bulan_tahun_key UNIQUE (therapist_id, bulan, tahun);


--
-- Name: internal_users internal_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_users
    ADD CONSTRAINT internal_users_pkey PRIMARY KEY (id);


--
-- Name: internal_wilayah internal_wilayah_kode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_wilayah
    ADD CONSTRAINT internal_wilayah_kode_key UNIQUE (kode);


--
-- Name: internal_wilayah internal_wilayah_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_wilayah
    ADD CONSTRAINT internal_wilayah_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: member_type member_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_type
    ADD CONSTRAINT member_type_name_key UNIQUE (name);


--
-- Name: member_type member_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_type
    ADD CONSTRAINT member_type_pkey PRIMARY KEY (id);


--
-- Name: order_sequences order_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_sequences
    ADD CONSTRAINT order_sequences_pkey PRIMARY KEY (year, month);


--
-- Name: patient_packages patient_packages_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_packages
    ADD CONSTRAINT patient_packages_order_id_key UNIQUE (order_id);


--
-- Name: patient_packages patient_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_packages
    ADD CONSTRAINT patient_packages_pkey PRIMARY KEY (id);


--
-- Name: patient_points patient_points_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_points
    ADD CONSTRAINT patient_points_patient_id_key UNIQUE (patient_id);


--
-- Name: patient_points patient_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_points
    ADD CONSTRAINT patient_points_pkey PRIMARY KEY (id);


--
-- Name: patient_visits patient_visits_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_visits
    ADD CONSTRAINT patient_visits_order_id_key UNIQUE (order_id);


--
-- Name: patient_visits patient_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_visits
    ADD CONSTRAINT patient_visits_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payroll_records payroll_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_pkey PRIMARY KEY (id);


--
-- Name: payroll_records payroll_records_staff_id_period_month_period_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_staff_id_period_month_period_year_key UNIQUE (staff_id, period_month, period_year);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: resume_links resume_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_links
    ADD CONSTRAINT resume_links_pkey PRIMARY KEY (id);


--
-- Name: resume_links resume_links_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_links
    ADD CONSTRAINT resume_links_token_key UNIQUE (token);


--
-- Name: salary_settings salary_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_settings
    ADD CONSTRAINT salary_settings_pkey PRIMARY KEY (id);


--
-- Name: salary_settings salary_settings_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_settings
    ADD CONSTRAINT salary_settings_role_key UNIQUE (role);


--
-- Name: schedule_overrides schedule_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_pkey PRIMARY KEY (id);


--
-- Name: schedule_slots schedule_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_slots_pkey PRIMARY KEY (id);


--
-- Name: schedule_slots schedule_slots_shift_slot_time_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_slots_shift_slot_time_key UNIQUE (shift, slot_time);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: service_areas service_areas_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_areas
    ADD CONSTRAINT service_areas_name_key UNIQUE (name);


--
-- Name: service_areas service_areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_areas
    ADD CONSTRAINT service_areas_pkey PRIMARY KEY (id);


--
-- Name: service_types service_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_name_key UNIQUE (name);


--
-- Name: service_types service_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_pkey PRIMARY KEY (id);


--
-- Name: session_note_settings session_note_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_note_settings
    ADD CONSTRAINT session_note_settings_pkey PRIMARY KEY (id);


--
-- Name: session_notes session_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_pkey PRIMARY KEY (id);


--
-- Name: session_notes session_notes_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_visit_id_key UNIQUE (visit_id);


--
-- Name: session_packages session_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_packages
    ADD CONSTRAINT session_packages_pkey PRIMARY KEY (id);


--
-- Name: shift_patterns shift_patterns_branch_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_patterns
    ADD CONSTRAINT shift_patterns_branch_id_code_key UNIQUE (branch_id, code);


--
-- Name: shift_patterns shift_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_patterns
    ADD CONSTRAINT shift_patterns_pkey PRIMARY KEY (id);


--
-- Name: shift_team_members shift_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_team_members
    ADD CONSTRAINT shift_team_members_pkey PRIMARY KEY (id);


--
-- Name: shift_teams shift_teams_branch_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_teams
    ADD CONSTRAINT shift_teams_branch_id_name_key UNIQUE (branch_id, name);


--
-- Name: shift_teams shift_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_teams
    ADD CONSTRAINT shift_teams_pkey PRIMARY KEY (id);


--
-- Name: staff_targets staff_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_targets
    ADD CONSTRAINT staff_targets_pkey PRIMARY KEY (id);


--
-- Name: staff_targets staff_targets_staff_id_bulan_tahun_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_targets
    ADD CONSTRAINT staff_targets_staff_id_bulan_tahun_key UNIQUE (staff_id, bulan, tahun);


--
-- Name: success_stories success_stories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.success_stories
    ADD CONSTRAINT success_stories_pkey PRIMARY KEY (id);


--
-- Name: terapi_awal_assessments terapi_awal_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terapi_awal_assessments
    ADD CONSTRAINT terapi_awal_assessments_pkey PRIMARY KEY (id);


--
-- Name: terapi_awal_assessments terapi_awal_assessments_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terapi_awal_assessments
    ADD CONSTRAINT terapi_awal_assessments_visit_id_key UNIQUE (visit_id);


--
-- Name: therapist_ratings therapist_ratings_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_booking_id_key UNIQUE (booking_id);


--
-- Name: therapist_ratings therapist_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_pkey PRIMARY KEY (id);


--
-- Name: therapists therapists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapists
    ADD CONSTRAINT therapists_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: treatment_logs treatment_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_logs
    ADD CONSTRAINT treatment_logs_pkey PRIMARY KEY (id);


--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);


--
-- Name: diagnoses_name_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX diagnoses_name_unique_idx ON public.diagnoses USING btree (upper(name));


--
-- Name: idx_booking_history_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_history_booking_id ON public.booking_history USING btree (booking_id);


--
-- Name: idx_booking_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_history_created_at ON public.booking_history USING btree (created_at);


--
-- Name: idx_bookings_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_city ON public.bookings USING btree (city);


--
-- Name: idx_bookings_guest_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_guest_email ON public.bookings USING btree (guest_email) WHERE (patient_id IS NULL);


--
-- Name: idx_bookings_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_location ON public.bookings USING btree (location_lat, location_lng) WHERE ((location_lat IS NOT NULL) AND (location_lng IS NOT NULL));


--
-- Name: idx_bookings_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_patient_id ON public.bookings USING btree (patient_id);


--
-- Name: idx_bookings_scheduled_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_scheduled_date ON public.bookings USING btree (scheduled_date);


--
-- Name: idx_bookings_scheduled_datetime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_scheduled_datetime ON public.bookings USING btree (scheduled_date, scheduled_time);


--
-- Name: idx_bookings_therapist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_therapist_id ON public.bookings USING btree (therapist_id);


--
-- Name: idx_internal_layanan_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_internal_layanan_branch ON public.internal_layanan USING btree (branch_id);


--
-- Name: idx_patient_packages_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_packages_patient ON public.patient_packages USING btree (patient_id, status);


--
-- Name: idx_patient_points_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_points_patient_id ON public.patient_points USING btree (patient_id);


--
-- Name: idx_patient_visits_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_visits_date_time ON public.patient_visits USING btree (visit_date, visit_time);


--
-- Name: idx_patient_visits_package; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patient_visits_package ON public.patient_visits USING btree (package_id) WHERE (package_id IS NOT NULL);


--
-- Name: idx_patients_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_is_active ON public.patients USING btree (is_active);


--
-- Name: idx_patients_member_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_member_type_id ON public.patients USING btree (member_type_id);


--
-- Name: idx_patients_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_profile_id ON public.patients USING btree (profile_id);


--
-- Name: idx_point_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_point_transactions_created_at ON public.point_transactions USING btree (created_at DESC);


--
-- Name: idx_point_transactions_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_point_transactions_patient_id ON public.point_transactions USING btree (patient_id);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_resume_links_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_links_branch_id ON public.resume_links USING btree (branch_id);


--
-- Name: idx_resume_links_visit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_links_visit_id ON public.resume_links USING btree (visit_id);


--
-- Name: idx_service_types_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_types_category ON public.service_types USING btree (category);


--
-- Name: idx_service_types_discount_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_types_discount_until ON public.service_types USING btree (discount_until);


--
-- Name: idx_service_types_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_types_display_order ON public.service_types USING btree (display_order);


--
-- Name: idx_service_types_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_types_is_active ON public.service_types USING btree (is_active);


--
-- Name: idx_shift_team_members_staff_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_team_members_staff_dates ON public.shift_team_members USING btree (staff_id, effective_start_date, effective_end_date);


--
-- Name: idx_sn_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sn_branch_id ON public.session_notes USING btree (branch_id);


--
-- Name: idx_sn_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sn_patient_id ON public.session_notes USING btree (patient_id);


--
-- Name: idx_taa_branch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_taa_branch_id ON public.terapi_awal_assessments USING btree (branch_id);


--
-- Name: idx_taa_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_taa_patient_id ON public.terapi_awal_assessments USING btree (patient_id);


--
-- Name: idx_therapist_ratings_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_ratings_booking_id ON public.therapist_ratings USING btree (booking_id);


--
-- Name: idx_therapist_ratings_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_ratings_patient_id ON public.therapist_ratings USING btree (patient_id);


--
-- Name: idx_therapist_ratings_therapist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapist_ratings_therapist_id ON public.therapist_ratings USING btree (therapist_id);


--
-- Name: idx_therapists_is_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapists_is_available ON public.therapists USING btree (is_available);


--
-- Name: idx_therapists_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapists_profile_id ON public.therapists USING btree (profile_id);


--
-- Name: idx_therapists_specializations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_therapists_specializations ON public.therapists USING gin (specializations);


--
-- Name: idx_transactions_fisio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transactions_fisio ON public.transactions USING btree (fisio_id);


--
-- Name: idx_treatment_logs_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treatment_logs_booking_id ON public.treatment_logs USING btree (booking_id);


--
-- Name: idx_treatment_logs_patient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treatment_logs_patient_id ON public.treatment_logs USING btree (patient_id);


--
-- Name: idx_treatment_logs_therapist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treatment_logs_therapist_id ON public.treatment_logs USING btree (therapist_id);


--
-- Name: idx_treatment_logs_treatment_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_treatment_logs_treatment_date ON public.treatment_logs USING btree (treatment_date);


--
-- Name: patients_name_normalized_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX patients_name_normalized_idx ON public.patients USING gin (name_normalized public.gin_trgm_ops);


--
-- Name: patients_no_rm_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patients_no_rm_unique ON public.patients USING btree (no_rm) WHERE (no_rm IS NOT NULL);


--
-- Name: patients_phone_hash_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX patients_phone_hash_unique ON public.patients USING btree (phone_hash) WHERE (phone_hash IS NOT NULL);


--
-- Name: schedules_staff_hari_week_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX schedules_staff_hari_week_key ON public.schedules USING btree (staff_id, hari, week_group);


--
-- Name: shift_team_members_one_active_per_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX shift_team_members_one_active_per_staff ON public.shift_team_members USING btree (staff_id) WHERE (effective_end_date IS NULL);


--
-- Name: employee_salaries employee_salaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER employee_salaries_updated_at BEFORE UPDATE ON public.employee_salaries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: payroll_records payroll_records_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payroll_records_updated_at BEFORE UPDATE ON public.payroll_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: salary_settings salary_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER salary_settings_updated_at BEFORE UPDATE ON public.salary_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: therapist_ratings therapist_ratings_update_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER therapist_ratings_update_trigger AFTER INSERT OR UPDATE ON public.therapist_ratings FOR EACH ROW EXECUTE FUNCTION public.update_therapist_ratings();


--
-- Name: internal_order_meta trg_trx_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_trx_code BEFORE INSERT ON public.internal_order_meta FOR EACH ROW WHEN (((new.kode_transaksi IS NULL) OR ((new.kode_transaksi)::text = ''::text))) EXECUTE FUNCTION public.generate_trx_code();


--
-- Name: bookings update_bookings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patients update_patients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: therapists update_therapists_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_therapists_updated_at BEFORE UPDATE ON public.therapists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: treatment_logs update_treatment_logs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_treatment_logs_updated_at BEFORE UPDATE ON public.treatment_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendance attendance_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: attendance attendance_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.internal_profiles(id);


--
-- Name: attendance attendance_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id);


--
-- Name: booking_history booking_history_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_history
    ADD CONSTRAINT booking_history_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_history booking_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_history
    ADD CONSTRAINT booking_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: booking_history booking_history_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_history
    ADD CONSTRAINT booking_history_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id) ON DELETE SET NULL;


--
-- Name: booking_payments booking_payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_payments
    ADD CONSTRAINT booking_payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_payments booking_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_payments
    ADD CONSTRAINT booking_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id);


--
-- Name: booking_sessions booking_sessions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_sessions
    ADD CONSTRAINT booking_sessions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: booking_sessions booking_sessions_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_sessions
    ADD CONSTRAINT booking_sessions_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id);


--
-- Name: bookings bookings_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id) ON DELETE CASCADE;


--
-- Name: branch_financial_reports branch_financial_reports_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_financial_reports
    ADD CONSTRAINT branch_financial_reports_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: branch_financial_reports branch_financial_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_financial_reports
    ADD CONSTRAINT branch_financial_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.internal_profiles(id);


--
-- Name: branch_financial_reports branch_financial_reports_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_financial_reports
    ADD CONSTRAINT branch_financial_reports_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.internal_profiles(id);


--
-- Name: branch_targets branch_targets_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_targets
    ADD CONSTRAINT branch_targets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: branch_targets branch_targets_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_targets
    ADD CONSTRAINT branch_targets_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.internal_profiles(id) ON DELETE SET NULL;


--
-- Name: branch_targets branch_targets_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch_targets
    ADD CONSTRAINT branch_targets_set_by_fkey FOREIGN KEY (set_by) REFERENCES public.internal_profiles(id) ON DELETE SET NULL;


--
-- Name: campaigns campaigns_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: campaigns campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id);


--
-- Name: diagnoses diagnoses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id);


--
-- Name: employee_salaries employee_salaries_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salaries
    ADD CONSTRAINT employee_salaries_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id) ON DELETE CASCADE;


--
-- Name: employee_salaries employee_salaries_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_salaries
    ADD CONSTRAINT employee_salaries_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.internal_profiles(id) ON DELETE SET NULL;


--
-- Name: internal_cuti internal_cuti_disetujui_oleh_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_cuti
    ADD CONSTRAINT internal_cuti_disetujui_oleh_fkey FOREIGN KEY (disetujui_oleh) REFERENCES public.internal_users(id);


--
-- Name: internal_cuti internal_cuti_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_cuti
    ADD CONSTRAINT internal_cuti_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.internal_users(id);


--
-- Name: internal_jadwal internal_jadwal_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_jadwal
    ADD CONSTRAINT internal_jadwal_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id);


--
-- Name: internal_layanan internal_layanan_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_layanan
    ADD CONSTRAINT internal_layanan_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;


--
-- Name: internal_master_jadwal internal_master_jadwal_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_master_jadwal
    ADD CONSTRAINT internal_master_jadwal_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id);


--
-- Name: internal_order_meta internal_order_meta_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_order_meta
    ADD CONSTRAINT internal_order_meta_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: internal_profiles internal_profiles_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_profiles
    ADD CONSTRAINT internal_profiles_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: internal_profiles internal_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_profiles
    ADD CONSTRAINT internal_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: internal_target internal_target_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_target
    ADD CONSTRAINT internal_target_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id);


--
-- Name: internal_users internal_users_jabatan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_users
    ADD CONSTRAINT internal_users_jabatan_id_fkey FOREIGN KEY (jabatan_id) REFERENCES public.internal_jabatan(id);


--
-- Name: internal_users internal_users_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_users
    ADD CONSTRAINT internal_users_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id);


--
-- Name: internal_wilayah internal_wilayah_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_wilayah
    ADD CONSTRAINT internal_wilayah_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.internal_wilayah(id);


--
-- Name: leave_requests leave_requests_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.internal_profiles(id);


--
-- Name: leave_requests leave_requests_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id);


--
-- Name: patient_packages patient_packages_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_packages
    ADD CONSTRAINT patient_packages_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: patient_packages patient_packages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_packages
    ADD CONSTRAINT patient_packages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id) ON DELETE SET NULL;


--
-- Name: patient_packages patient_packages_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_packages
    ADD CONSTRAINT patient_packages_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_points patient_points_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_points
    ADD CONSTRAINT patient_points_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: patient_visits patient_visits_attending_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_visits
    ADD CONSTRAINT patient_visits_attending_staff_id_fkey FOREIGN KEY (attending_staff_id) REFERENCES public.internal_profiles(id);


--
-- Name: patient_visits patient_visits_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_visits
    ADD CONSTRAINT patient_visits_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: patient_visits patient_visits_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_visits
    ADD CONSTRAINT patient_visits_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.patient_packages(id) ON DELETE SET NULL;


--
-- Name: patients patients_member_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_member_type_id_fkey FOREIGN KEY (member_type_id) REFERENCES public.member_type(id);


--
-- Name: patients patients_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: payroll_records payroll_records_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;


--
-- Name: payroll_records payroll_records_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.internal_profiles(id) ON DELETE SET NULL;


--
-- Name: payroll_records payroll_records_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id) ON DELETE SET NULL;


--
-- Name: payroll_records payroll_records_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id) ON DELETE CASCADE;


--
-- Name: payroll_records payroll_records_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_records
    ADD CONSTRAINT payroll_records_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: point_transactions point_transactions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: point_transactions point_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: point_transactions point_transactions_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.session_packages(id) ON DELETE SET NULL;


--
-- Name: point_transactions point_transactions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: resume_links resume_links_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_links
    ADD CONSTRAINT resume_links_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: resume_links resume_links_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_links
    ADD CONSTRAINT resume_links_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id);


--
-- Name: resume_links resume_links_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_links
    ADD CONSTRAINT resume_links_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.patient_visits(id) ON DELETE CASCADE;


--
-- Name: salary_settings salary_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salary_settings
    ADD CONSTRAINT salary_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.internal_profiles(id) ON DELETE SET NULL;


--
-- Name: schedule_overrides schedule_overrides_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: schedule_overrides schedule_overrides_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id);


--
-- Name: schedule_overrides schedule_overrides_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_overrides
    ADD CONSTRAINT schedule_overrides_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: schedules schedules_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id) ON DELETE CASCADE;


--
-- Name: session_note_settings session_note_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_note_settings
    ADD CONSTRAINT session_note_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.internal_profiles(id);


--
-- Name: session_notes session_notes_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: session_notes session_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id);


--
-- Name: session_notes session_notes_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: session_notes session_notes_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.patient_visits(id) ON DELETE CASCADE;


--
-- Name: session_packages session_packages_card_type_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_packages
    ADD CONSTRAINT session_packages_card_type_fkey FOREIGN KEY (card_type) REFERENCES public.member_type(id);


--
-- Name: shift_patterns shift_patterns_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_patterns
    ADD CONSTRAINT shift_patterns_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: shift_team_members shift_team_members_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_team_members
    ADD CONSTRAINT shift_team_members_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id);


--
-- Name: shift_team_members shift_team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_team_members
    ADD CONSTRAINT shift_team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.shift_teams(id);


--
-- Name: shift_teams shift_teams_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_teams
    ADD CONSTRAINT shift_teams_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: shift_teams shift_teams_pola_x_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_teams
    ADD CONSTRAINT shift_teams_pola_x_id_fkey FOREIGN KEY (pola_x_id) REFERENCES public.shift_patterns(id);


--
-- Name: shift_teams shift_teams_pola_y_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_teams
    ADD CONSTRAINT shift_teams_pola_y_id_fkey FOREIGN KEY (pola_y_id) REFERENCES public.shift_patterns(id);


--
-- Name: staff_targets staff_targets_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_targets
    ADD CONSTRAINT staff_targets_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: staff_targets staff_targets_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_targets
    ADD CONSTRAINT staff_targets_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.internal_profiles(id);


--
-- Name: staff_targets staff_targets_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_targets
    ADD CONSTRAINT staff_targets_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.internal_profiles(id) ON DELETE CASCADE;


--
-- Name: terapi_awal_assessments terapi_awal_assessments_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terapi_awal_assessments
    ADD CONSTRAINT terapi_awal_assessments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: terapi_awal_assessments terapi_awal_assessments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terapi_awal_assessments
    ADD CONSTRAINT terapi_awal_assessments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_profiles(id);


--
-- Name: terapi_awal_assessments terapi_awal_assessments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terapi_awal_assessments
    ADD CONSTRAINT terapi_awal_assessments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: terapi_awal_assessments terapi_awal_assessments_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terapi_awal_assessments
    ADD CONSTRAINT terapi_awal_assessments_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.patient_visits(id) ON DELETE CASCADE;


--
-- Name: therapist_ratings therapist_ratings_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: therapist_ratings therapist_ratings_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: therapist_ratings therapist_ratings_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapist_ratings
    ADD CONSTRAINT therapist_ratings_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id) ON DELETE CASCADE;


--
-- Name: therapists therapists_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.therapists
    ADD CONSTRAINT therapists_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: transactions transactions_confirmed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.internal_profiles(id);


--
-- Name: transactions transactions_fisio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_fisio_id_fkey FOREIGN KEY (fisio_id) REFERENCES public.internal_profiles(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.internal_profiles(id);


--
-- Name: transactions transactions_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.patient_visits(id);


--
-- Name: treatment_logs treatment_logs_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_logs
    ADD CONSTRAINT treatment_logs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: treatment_logs treatment_logs_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_logs
    ADD CONSTRAINT treatment_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: treatment_logs treatment_logs_therapist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.treatment_logs
    ADD CONSTRAINT treatment_logs_therapist_id_fkey FOREIGN KEY (therapist_id) REFERENCES public.therapists(id) ON DELETE CASCADE;


--
-- Name: user_notifications user_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.internal_profiles(id);


--
-- Name: point_transactions Admin and therapist insert transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and therapist insert transactions" ON public.point_transactions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.user_role, 'therapist'::public.user_role]))))));


--
-- Name: patient_points Admin and therapist read all points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and therapist read all points" ON public.patient_points FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.user_role, 'therapist'::public.user_role]))))));


--
-- Name: point_transactions Admin and therapist read all transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and therapist read all transactions" ON public.point_transactions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::public.user_role, 'therapist'::public.user_role]))))));


--
-- Name: dp_settings Admin can manage dp_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage dp_settings" ON public.dp_settings USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: bank_accounts Admin can modify bank_accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can modify bank_accounts" ON public.bank_accounts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: patient_points Admin can modify points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can modify points" ON public.patient_points USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: session_packages Admin can modify session_packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can modify session_packages" ON public.session_packages USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: blog_posts Admin full access to blog posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin full access to blog posts" ON public.blog_posts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: gallery_videos Admin full access to gallery videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin full access to gallery videos" ON public.gallery_videos USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: homepage_services Admin full access to homepage services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin full access to homepage services" ON public.homepage_services USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: success_stories Admin full access to stories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin full access to stories" ON public.success_stories USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: clinic_settings Admins can manage clinic_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage clinic_settings" ON public.clinic_settings USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: therapist_ratings Admins can read all ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read all ratings" ON public.therapist_ratings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: clinic_settings Admins can read clinic_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can read clinic_settings" ON public.clinic_settings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: patients Admins have full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins have full access" ON public.patients USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: profiles Admins have full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins have full access" ON public.profiles USING ((EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = 'admin'::public.user_role)))));


--
-- Name: therapists Admins have full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins have full access" ON public.therapists USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: gallery_videos Anyone can read active gallery videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active gallery videos" ON public.gallery_videos FOR SELECT USING ((is_active = true));


--
-- Name: bank_accounts Anyone can read bank_accounts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read bank_accounts" ON public.bank_accounts FOR SELECT USING (true);


--
-- Name: member_type Anyone can read member_type; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read member_type" ON public.member_type FOR SELECT USING (true);


--
-- Name: blog_posts Anyone can read published blog posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read published blog posts" ON public.blog_posts FOR SELECT USING ((is_published = true));


--
-- Name: success_stories Anyone can read published stories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read published stories" ON public.success_stories FOR SELECT USING ((is_published = true));


--
-- Name: session_packages Anyone can read session_packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read session_packages" ON public.session_packages FOR SELECT USING (true);


--
-- Name: profiles Deny all by default; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Deny all by default" ON public.profiles USING (false);


--
-- Name: member_type Only admins can modify member_type; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only admins can modify member_type" ON public.member_type USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: patient_points Patient reads own points; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patient reads own points" ON public.patient_points FOR SELECT USING ((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.profile_id = auth.uid()))));


--
-- Name: point_transactions Patient reads own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patient reads own transactions" ON public.point_transactions FOR SELECT USING ((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.profile_id = auth.uid()))));


--
-- Name: therapist_ratings Patients can create ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can create ratings" ON public.therapist_ratings FOR INSERT WITH CHECK ((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.profile_id = auth.uid()))));


--
-- Name: bookings Patients can rate completed bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can rate completed bookings" ON public.bookings FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = bookings.patient_id) AND (p.profile_id = auth.uid())))) AND (status = 'completed'::text)));


--
-- Name: patients Patients can read own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can read own data" ON public.patients FOR SELECT USING ((profile_id = auth.uid()));


--
-- Name: therapist_ratings Patients can read their own ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can read their own ratings" ON public.therapist_ratings FOR SELECT USING ((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.profile_id = auth.uid()))));


--
-- Name: patients Patients can update own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can update own preferences" ON public.patients FOR UPDATE USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: therapist_ratings Patients can update their own ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can update their own ratings" ON public.therapist_ratings FOR UPDATE USING ((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.profile_id = auth.uid()))));


--
-- Name: therapists Patients can view available therapists; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view available therapists" ON public.therapists FOR SELECT USING (((is_available = true) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'patient'::public.user_role))))));


--
-- Name: clinic_settings Public can read QRIS image; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read QRIS image" ON public.clinic_settings FOR SELECT USING ((setting_key = 'qris_image_url'::text));


--
-- Name: dp_settings Public can read dp_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read dp_settings" ON public.dp_settings FOR SELECT USING (true);


--
-- Name: therapist_ratings Public can read ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read ratings" ON public.therapist_ratings FOR SELECT USING (true);


--
-- Name: homepage_services Public can view active homepage services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view active homepage services" ON public.homepage_services FOR SELECT USING ((is_active = true));


--
-- Name: treatment_logs Therapists can create treatment logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Therapists can create treatment logs" ON public.treatment_logs FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.therapists t
  WHERE ((t.id = treatment_logs.therapist_id) AND (t.profile_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = treatment_logs.booking_id) AND (b.therapist_id = b.therapist_id) AND (b.status = ANY (ARRAY['confirmed'::text, 'in_progress'::text, 'completed'::text]))))) AND ((patient_id IS NOT NULL) OR (guest_name IS NOT NULL))));


--
-- Name: patients Therapists can read assigned patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Therapists can read assigned patients" ON public.patients FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'therapist'::public.user_role)))) AND (EXISTS ( SELECT 1
   FROM (public.bookings b
     JOIN public.therapists t ON ((t.id = b.therapist_id)))
  WHERE ((b.patient_id = patients.id) AND (t.profile_id = auth.uid()))))));


--
-- Name: therapists Therapists can read own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Therapists can read own data" ON public.therapists FOR SELECT USING ((profile_id = auth.uid()));


--
-- Name: clinic_settings Therapists can read sharing fee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Therapists can read sharing fee" ON public.clinic_settings FOR SELECT USING (((setting_key = 'sharing_fee_percentage'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'therapist'::public.user_role))))));


--
-- Name: therapist_ratings Therapists can read their ratings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Therapists can read their ratings" ON public.therapist_ratings FOR SELECT USING ((therapist_id IN ( SELECT therapists.id
   FROM public.therapists
  WHERE (therapists.profile_id = auth.uid()))));


--
-- Name: therapists Therapists can update own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Therapists can update own data" ON public.therapists FOR UPDATE USING ((profile_id = auth.uid())) WITH CHECK ((profile_id = auth.uid()));


--
-- Name: profiles Users can read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING ((id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: bookings admin_all_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_all_access ON public.bookings USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: treatment_logs admin_full_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_full_access ON public.treatment_logs USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: booking_history allow_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_admin_insert ON public.booking_history FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: service_types allow_admin_manage_service_types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_admin_manage_service_types ON public.service_types USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: bookings allow_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_insert ON public.bookings FOR INSERT WITH CHECK (true);


--
-- Name: service_types allow_read_active_service_types; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_read_active_service_types ON public.service_types FOR SELECT USING ((is_active = true));


--
-- Name: booking_history allow_read_own_bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allow_read_own_bookings ON public.booking_history FOR SELECT USING (((auth.uid() IN ( SELECT b.patient_id
   FROM public.bookings b
  WHERE ((b.id = booking_history.booking_id) AND (b.patient_id IS NOT NULL)))) OR (auth.uid() IN ( SELECT t.profile_id
   FROM public.therapists t
  WHERE (t.id = booking_history.therapist_id))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


--
-- Name: attendance att: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "att: director all" ON public.attendance USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: attendance att: hr branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "att: hr branch" ON public.attendance USING (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: attendance att: manager branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "att: manager branch" ON public.attendance USING (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: attendance att: own read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "att: own read" ON public.attendance FOR SELECT USING ((staff_id = auth.uid()));


--
-- Name: attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: bank_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: branch_financial_reports bfr: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bfr: director all" ON public.branch_financial_reports USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: branch_financial_reports bfr: finance branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bfr: finance branch" ON public.branch_financial_reports USING (((public.get_my_internal_role() = 'finance'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'finance'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: branch_financial_reports bfr: manager branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bfr: manager branch" ON public.branch_financial_reports USING (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_history ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_packages branch staff manage patient_packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branch staff manage patient_packages" ON public.patient_packages USING (((branch_id = public.get_my_branch()) OR (public.get_my_branch() IS NULL))) WITH CHECK (((branch_id = public.get_my_branch()) OR (public.get_my_branch() IS NULL)));


--
-- Name: branch_financial_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branch_financial_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: branch_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branch_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: branches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

--
-- Name: branches branches: director manages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branches: director manages" ON public.branches USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: branches branches: staff reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "branches: staff reads" ON public.branches FOR SELECT USING (((id = public.get_my_branch()) OR (public.get_my_internal_role() = 'director'::text)));


--
-- Name: branch_targets bt: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bt: director all" ON public.branch_targets USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: branch_targets bt: manager branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bt: manager branch" ON public.branch_targets USING (((public.get_my_internal_role() = 'manager'::text) AND (public.get_my_branch() IS NOT NULL) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (public.get_my_branch() IS NOT NULL) AND (branch_id = public.get_my_branch())));


--
-- Name: branch_targets bt: staff reads own branch approved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "bt: staff reads own branch approved" ON public.branch_targets FOR SELECT USING (((branch_id = public.get_my_branch()) AND (status = 'approved'::text)));


--
-- Name: campaigns camp: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "camp: director all" ON public.campaigns USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: campaigns camp: manager branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "camp: manager branch" ON public.campaigns USING (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: campaigns camp: marketing branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "camp: marketing branch" ON public.campaigns USING (((public.get_my_internal_role() = 'marketing'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'marketing'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: clinic_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_history deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deny_all ON public.booking_history USING (false);


--
-- Name: diagnoses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diagnoses ENABLE ROW LEVEL SECURITY;

--
-- Name: diagnoses diagnoses_insert_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY diagnoses_insert_all ON public.diagnoses FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: diagnoses diagnoses_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY diagnoses_select_all ON public.diagnoses FOR SELECT TO authenticated USING (true);


--
-- Name: dp_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dp_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_salaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_salaries ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_salaries es: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "es: director all" ON public.employee_salaries USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: employee_salaries es: manager branch read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "es: manager branch read" ON public.employee_salaries FOR SELECT USING (((public.get_my_internal_role() = 'manager'::text) AND (public.get_my_branch() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.internal_profiles ip
  WHERE ((ip.id = employee_salaries.staff_id) AND (ip.branch_id = public.get_my_branch()))))));


--
-- Name: gallery_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gallery_videos ENABLE ROW LEVEL SECURITY;

--
-- Name: homepage_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homepage_services ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_packages internal staff read patient_packages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal staff read patient_packages" ON public.patient_packages FOR SELECT USING ((public.get_my_internal_role() IS NOT NULL));


--
-- Name: internal_cuti; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_cuti ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_cuti internal_cuti: admin update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_cuti: admin update" ON public.internal_cuti FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_cuti internal_cuti: own create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_cuti: own create" ON public.internal_cuti FOR INSERT WITH CHECK ((user_id = ( SELECT internal_users.id
   FROM public.internal_users
  WHERE (internal_users.profile_id = auth.uid()))));


--
-- Name: internal_cuti internal_cuti: own or admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_cuti: own or admin read" ON public.internal_cuti FOR SELECT USING (((user_id = ( SELECT internal_users.id
   FROM public.internal_users
  WHERE (internal_users.profile_id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


--
-- Name: internal_jabatan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_jabatan ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_jabatan internal_jabatan: admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_jabatan: admin write" ON public.internal_jabatan USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_jabatan internal_jabatan: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_jabatan: staff read" ON public.internal_jabatan FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_jadwal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_jadwal ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_jadwal internal_jadwal: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_jadwal: staff read" ON public.internal_jadwal FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_jadwal internal_jadwal: staff write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_jadwal: staff write" ON public.internal_jadwal USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_jam_shift; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_jam_shift ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_jam_shift internal_jam_shift: admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_jam_shift: admin write" ON public.internal_jam_shift USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_jam_shift internal_jam_shift: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_jam_shift: staff read" ON public.internal_jam_shift FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_konfigurasi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_konfigurasi ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_konfigurasi internal_konfigurasi: admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_konfigurasi: admin write" ON public.internal_konfigurasi USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_konfigurasi internal_konfigurasi: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_konfigurasi: staff read" ON public.internal_konfigurasi FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_layanan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_layanan ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_layanan internal_layanan: admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_layanan: admin write" ON public.internal_layanan USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_layanan internal_layanan: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_layanan: staff read" ON public.internal_layanan FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_master_jadwal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_master_jadwal ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_master_jadwal internal_master_jadwal: admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_master_jadwal: admin write" ON public.internal_master_jadwal USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_master_jadwal internal_master_jadwal: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_master_jadwal: staff read" ON public.internal_master_jadwal FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_order_meta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_order_meta ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_order_meta internal_order_meta: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_order_meta: staff read" ON public.internal_order_meta FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_order_meta internal_order_meta: staff write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_order_meta: staff write" ON public.internal_order_meta USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_profiles internal_profiles_admin_own_branch_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_profiles_admin_own_branch_select ON public.internal_profiles FOR SELECT USING (((public.get_my_internal_role() = 'admin'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: internal_referensi; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_referensi ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_referensi internal_referensi: admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_referensi: admin write" ON public.internal_referensi USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_referensi internal_referensi: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_referensi: staff read" ON public.internal_referensi FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: booking_payments internal_staff_booking_payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_staff_booking_payments ON public.booking_payments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: booking_sessions internal_staff_booking_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_staff_booking_sessions ON public.booking_sessions TO authenticated USING (true) WITH CHECK (true);


--
-- Name: patients internal_staff_can_insert_patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY internal_staff_can_insert_patients ON public.patients FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.internal_profiles
  WHERE ((internal_profiles.id = auth.uid()) AND (internal_profiles.is_active = true) AND (internal_profiles.role <> 'non-staff'::public.internal_user_role)))));


--
-- Name: internal_target; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_target ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_target internal_target: admin approve; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_target: admin approve" ON public.internal_target FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_target internal_target: own or admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_target: own or admin read" ON public.internal_target FOR SELECT USING (((therapist_id IN ( SELECT t.id
   FROM (public.therapists t
     JOIN public.profiles p ON ((p.id = t.profile_id)))
  WHERE (p.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


--
-- Name: internal_target internal_target: staff create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_target: staff create" ON public.internal_target FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: internal_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_users ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_users internal_users: admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_users: admin write" ON public.internal_users USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_users internal_users: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_users: staff read" ON public.internal_users FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_wilayah; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.internal_wilayah ENABLE ROW LEVEL SECURITY;

--
-- Name: internal_wilayah internal_wilayah: admin write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_wilayah: admin write" ON public.internal_wilayah USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: internal_wilayah internal_wilayah: staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "internal_wilayah: staff read" ON public.internal_wilayah FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: internal_profiles ip: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ip: director all" ON public.internal_profiles USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: internal_profiles ip: hr reads branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ip: hr reads branch" ON public.internal_profiles FOR SELECT USING (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: internal_profiles ip: manager reads branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ip: manager reads branch" ON public.internal_profiles FOR SELECT USING (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: internal_profiles ip: own insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ip: own insert" ON public.internal_profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: internal_profiles ip: own read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ip: own read" ON public.internal_profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: internal_profiles ip: own update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ip: own update" ON public.internal_profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK (((auth.uid() = id) AND (role = ( SELECT p.role
   FROM public.internal_profiles p
  WHERE (p.id = auth.uid())))));


--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests lr: admin branch view; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lr: admin branch view" ON public.leave_requests FOR SELECT USING (((public.get_my_internal_role() = 'admin'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: leave_requests lr: hr_director_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lr: hr_director_all" ON public.leave_requests TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.internal_profiles ip
  WHERE ((ip.id = ( SELECT auth.uid() AS uid)) AND (ip.is_active = true) AND ((ip.role = 'director'::public.internal_user_role) OR ((ip.role = 'hr'::public.internal_user_role) AND (ip.branch_id = leave_requests.branch_id))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.internal_profiles ip
  WHERE ((ip.id = ( SELECT auth.uid() AS uid)) AND (ip.is_active = true) AND ((ip.role = 'director'::public.internal_user_role) OR ((ip.role = 'hr'::public.internal_user_role) AND (ip.branch_id = leave_requests.branch_id)))))));


--
-- Name: leave_requests lr: manager branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lr: manager branch" ON public.leave_requests USING (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: leave_requests lr: own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "lr: own" ON public.leave_requests TO authenticated USING ((staff_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((staff_id = ( SELECT auth.uid() AS uid)));


--
-- Name: member_type; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_type ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notifications notif: by role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notif: by role" ON public.user_notifications FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.internal_profiles ip
  WHERE ((ip.id = auth.uid()) AND ((ip.role)::text = (user_notifications.target_role)::text)))));


--
-- Name: user_notifications notif: own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "notif: own" ON public.user_notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: order_sequences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_sequences ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings patient_create_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY patient_create_own ON public.bookings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.patients
  WHERE ((patients.id = bookings.patient_id) AND (patients.profile_id = auth.uid())))));


--
-- Name: patient_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: patient_points; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_points ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings patient_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY patient_read_own ON public.bookings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.patients
  WHERE ((patients.id = bookings.patient_id) AND (patients.profile_id = auth.uid())))));


--
-- Name: treatment_logs patient_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY patient_read_own ON public.treatment_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.patients p
  WHERE ((p.id = treatment_logs.patient_id) AND (p.profile_id = auth.uid())))));


--
-- Name: patient_visits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;

--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

--
-- Name: patients patients: internal staff read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "patients: internal staff read" ON public.patients FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.internal_profiles
  WHERE ((internal_profiles.id = auth.uid()) AND (internal_profiles.is_active = true)))));


--
-- Name: payroll_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

--
-- Name: point_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: payroll_records pr: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pr: director all" ON public.payroll_records USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: payroll_records pr: manager branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pr: manager branch" ON public.payroll_records USING (((public.get_my_internal_role() = 'manager'::text) AND (public.get_my_branch() IS NOT NULL) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (public.get_my_branch() IS NOT NULL) AND (branch_id = public.get_my_branch())));


--
-- Name: patient_visits pv: branch staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pv: branch staff" ON public.patient_visits USING ((branch_id = public.get_my_branch())) WITH CHECK ((branch_id = public.get_my_branch()));


--
-- Name: patient_visits pv: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "pv: director all" ON public.patient_visits USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: resume_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resume_links ENABLE ROW LEVEL SECURITY;

--
-- Name: resume_links resume_links_branch_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resume_links_branch_staff_all ON public.resume_links USING ((branch_id = public.get_my_branch())) WITH CHECK ((branch_id = public.get_my_branch()));


--
-- Name: resume_links resume_links_director_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resume_links_director_all ON public.resume_links USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: salary_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_overrides schedule_overrides_admin_own_branch_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_overrides_admin_own_branch_select ON public.schedule_overrides FOR SELECT USING (((public.get_my_internal_role() = 'admin'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: schedule_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_slots schedule_slots_director_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_slots_director_manage ON public.schedule_slots USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: schedule_slots schedule_slots_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_slots_select_all ON public.schedule_slots FOR SELECT USING ((public.get_my_internal_role() IS NOT NULL));


--
-- Name: schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: schedules schedules: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "schedules: director all" ON public.schedules USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: schedules schedules: hr all own branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "schedules: hr all own branch" ON public.schedules USING (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: schedules schedules: manager all own branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "schedules: manager all own branch" ON public.schedules USING (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: schedules schedules: self access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "schedules: self access" ON public.schedules USING ((staff_id = auth.uid())) WITH CHECK ((staff_id = auth.uid()));


--
-- Name: schedules schedules_admin_own_branch_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedules_admin_own_branch_select ON public.schedules FOR SELECT USING (((public.get_my_internal_role() = 'admin'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: service_areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

--
-- Name: service_areas service_areas are deletable by admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_areas are deletable by admins" ON public.service_areas FOR DELETE USING ((auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.role = 'admin'::public.user_role))));


--
-- Name: service_areas service_areas are insertable by admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_areas are insertable by admins" ON public.service_areas FOR INSERT WITH CHECK ((auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.role = 'admin'::public.user_role))));


--
-- Name: service_areas service_areas are updatable by admins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_areas are updatable by admins" ON public.service_areas FOR UPDATE USING ((auth.uid() IN ( SELECT profiles.id
   FROM public.profiles
  WHERE (profiles.role = 'admin'::public.user_role))));


--
-- Name: service_areas service_areas are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "service_areas are viewable by everyone" ON public.service_areas FOR SELECT USING (true);


--
-- Name: service_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

--
-- Name: session_note_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_note_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: session_note_settings session_note_settings_director_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_note_settings_director_manage ON public.session_note_settings USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: session_note_settings session_note_settings_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY session_note_settings_select_all ON public.session_note_settings FOR SELECT USING ((public.get_my_internal_role() IS NOT NULL));


--
-- Name: session_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: session_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_patterns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_patterns ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_patterns shift_patterns_director_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_patterns_director_all ON public.shift_patterns USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: shift_patterns shift_patterns_hr_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_patterns_hr_own_branch ON public.shift_patterns USING (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: shift_patterns shift_patterns_select_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_patterns_select_own_branch ON public.shift_patterns FOR SELECT USING (((public.get_my_internal_role() IS NOT NULL) AND (branch_id = public.get_my_branch())));


--
-- Name: shift_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shift_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_teams shift_teams_director_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_teams_director_all ON public.shift_teams USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: shift_teams shift_teams_hr_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_teams_hr_own_branch ON public.shift_teams USING (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: shift_teams shift_teams_select_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shift_teams_select_own_branch ON public.shift_teams FOR SELECT USING (((public.get_my_internal_role() IS NOT NULL) AND (branch_id = public.get_my_branch())));


--
-- Name: session_notes sn_branch_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sn_branch_staff_all ON public.session_notes USING ((branch_id = public.get_my_branch())) WITH CHECK ((branch_id = public.get_my_branch()));


--
-- Name: session_notes sn_director_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sn_director_all ON public.session_notes USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: salary_settings ss: authenticated read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ss: authenticated read" ON public.salary_settings FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: salary_settings ss: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "ss: director all" ON public.salary_settings USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: staff_targets st: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "st: director all" ON public.staff_targets USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: staff_targets st: hr reads branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "st: hr reads branch" ON public.staff_targets FOR SELECT USING (((public.get_my_internal_role() = 'hr'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: staff_targets st: manager branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "st: manager branch" ON public.staff_targets USING (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: staff_targets st: own all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "st: own all" ON public.staff_targets USING ((staff_id = auth.uid())) WITH CHECK ((staff_id = auth.uid()));


--
-- Name: staff_targets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_targets ENABLE ROW LEVEL SECURITY;

--
-- Name: shift_team_members stm_director_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stm_director_all ON public.shift_team_members USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: shift_team_members stm_hr_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stm_hr_own_branch ON public.shift_team_members USING (((public.get_my_internal_role() = 'hr'::text) AND (team_id IN ( SELECT shift_teams.id
   FROM public.shift_teams
  WHERE (shift_teams.branch_id = public.get_my_branch()))))) WITH CHECK (((public.get_my_internal_role() = 'hr'::text) AND (team_id IN ( SELECT shift_teams.id
   FROM public.shift_teams
  WHERE (shift_teams.branch_id = public.get_my_branch())))));


--
-- Name: shift_team_members stm_select_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY stm_select_own_branch ON public.shift_team_members FOR SELECT USING (((public.get_my_internal_role() IS NOT NULL) AND (team_id IN ( SELECT shift_teams.id
   FROM public.shift_teams
  WHERE (shift_teams.branch_id = public.get_my_branch())))));


--
-- Name: success_stories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;

--
-- Name: terapi_awal_assessments taa_branch_staff_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY taa_branch_staff_all ON public.terapi_awal_assessments USING ((branch_id = public.get_my_branch())) WITH CHECK ((branch_id = public.get_my_branch()));


--
-- Name: terapi_awal_assessments taa_director_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY taa_director_all ON public.terapi_awal_assessments USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: terapi_awal_assessments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.terapi_awal_assessments ENABLE ROW LEVEL SECURITY;

--
-- Name: treatment_logs therapist_create; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY therapist_create ON public.treatment_logs FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.therapists t
  WHERE ((t.id = treatment_logs.therapist_id) AND (t.profile_id = auth.uid())))) AND (EXISTS ( SELECT 1
   FROM public.bookings b
  WHERE ((b.id = treatment_logs.booking_id) AND (b.therapist_id = b.therapist_id) AND (b.status = ANY (ARRAY['in_progress'::text, 'completed'::text])))))));


--
-- Name: therapist_ratings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.therapist_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings therapist_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY therapist_read_own ON public.bookings FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.therapists
  WHERE ((therapists.id = bookings.therapist_id) AND (therapists.profile_id = auth.uid())))));


--
-- Name: treatment_logs therapist_read_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY therapist_read_own ON public.treatment_logs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.therapists t
  WHERE ((t.id = treatment_logs.therapist_id) AND (t.profile_id = auth.uid())))));


--
-- Name: treatment_logs therapist_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY therapist_update_own ON public.treatment_logs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.therapists t
  WHERE ((t.id = treatment_logs.therapist_id) AND (t.profile_id = auth.uid())))));


--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions transactions_admin_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_admin_own_branch ON public.transactions USING (((public.get_my_internal_role() = 'admin'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'admin'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: transactions transactions_director_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_director_all ON public.transactions USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: transactions transactions_finance_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_finance_own_branch ON public.transactions USING (((public.get_my_internal_role() = 'finance'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'finance'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: transactions transactions_manager_own_branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_manager_own_branch ON public.transactions USING (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: treatment_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.treatment_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions tx: director all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tx: director all" ON public.transactions USING ((public.get_my_internal_role() = 'director'::text)) WITH CHECK ((public.get_my_internal_role() = 'director'::text));


--
-- Name: transactions tx: finance branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tx: finance branch" ON public.transactions USING (((public.get_my_internal_role() = 'finance'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'finance'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: transactions tx: manager branch; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "tx: manager branch" ON public.transactions USING (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch()))) WITH CHECK (((public.get_my_internal_role() = 'manager'::text) AND (branch_id = public.get_my_branch())));


--
-- Name: user_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 0Jf5zldz7BEb84yy0dPhHZYNwzID0AQUMAxzqg0DrzwZFtM4ohnk7uchMP1mirQ

