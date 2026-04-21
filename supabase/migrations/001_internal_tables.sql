-- ============================================================
-- TeamFGS Internal Tables — Phase 1 Migration
-- All tables use the internal_ prefix to avoid schema conflicts
-- with the gangsehat.com public tables (READ ONLY).
-- RLS is enabled on every table.
-- ============================================================

-- ── Positions (Jabatan) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS internal_jabatan (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama       varchar(100) NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE internal_jabatan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_jabatan: staff read"
  ON internal_jabatan FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_jabatan: admin write"
  ON internal_jabatan FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Internal Users ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS internal_users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id),
  jabatan_id uuid REFERENCES internal_jabatan(id),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE internal_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_users: staff read"
  ON internal_users FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_users: admin write"
  ON internal_users FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Extended Services (Layanan) ──────────────────────────────
CREATE TABLE IF NOT EXISTS internal_layanan (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama        varchar(200) NOT NULL,
  kategori    varchar(100) NOT NULL,
  jumlah_sesi int,
  harga       numeric(12, 0) NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE internal_layanan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_layanan: staff read"
  ON internal_layanan FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_layanan: admin write"
  ON internal_layanan FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Shift Hours (Jam Shift) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS internal_jam_shift (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift       varchar(10) NOT NULL CHECK (shift IN ('PAGI', 'SORE')),
  jam_mulai   time NOT NULL,
  jam_selesai time NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE internal_jam_shift ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_jam_shift: staff read"
  ON internal_jam_shift FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_jam_shift: admin write"
  ON internal_jam_shift FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Master Schedule Template (Master Jadwal) ─────────────────
CREATE TABLE IF NOT EXISTS internal_master_jadwal (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id),
  hari         varchar(10) NOT NULL,
  shift        varchar(10) NOT NULL CHECK (shift IN ('PAGI', 'SORE')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, hari, shift)
);

ALTER TABLE internal_master_jadwal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_master_jadwal: staff read"
  ON internal_master_jadwal FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_master_jadwal: admin write"
  ON internal_master_jadwal FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Generated Daily Schedules (Jadwal) ───────────────────────
CREATE TABLE IF NOT EXISTS internal_jadwal (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id),
  tanggal      date NOT NULL,
  shift        varchar(10) NOT NULL CHECK (shift IN ('PAGI', 'SORE')),
  status       varchar(10) NOT NULL DEFAULT 'TERSEDIA'
                 CHECK (status IN ('TERSEDIA', 'OFF', 'CUTI', 'MASUK')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, tanggal, shift)
);

ALTER TABLE internal_jadwal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_jadwal: staff read"
  ON internal_jadwal FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_jadwal: staff write"
  ON internal_jadwal FOR ALL
  USING (auth.role() = 'authenticated');

-- ── Leave Requests (Cuti) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS internal_cuti (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES internal_users(id),
  tanggal_mulai     date NOT NULL,
  tanggal_selesai   date NOT NULL,
  alasan            text NOT NULL,
  bukti_url         text,
  status            varchar(10) NOT NULL DEFAULT 'MENUNGGU'
                      CHECK (status IN ('MENUNGGU', 'DISETUJUI', 'DITOLAK')),
  disetujui_oleh    uuid REFERENCES internal_users(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE internal_cuti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_cuti: own or admin read"
  ON internal_cuti FOR SELECT
  USING (
    user_id = (SELECT id FROM internal_users WHERE profile_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "internal_cuti: own create"
  ON internal_cuti FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM internal_users WHERE profile_id = auth.uid())
  );

CREATE POLICY "internal_cuti: admin update"
  ON internal_cuti FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Monthly Targets (Target) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS internal_target (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id            uuid NOT NULL REFERENCES public.therapists(id),
  bulan                   int NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  tahun                   int NOT NULL,
  target_terapi_awal      int NOT NULL DEFAULT 0,
  target_paket_klinik     int NOT NULL DEFAULT 0,
  target_kunjungan        int NOT NULL DEFAULT 0,
  target_homevisit_paket  int NOT NULL DEFAULT 0,
  approved                boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (therapist_id, bulan, tahun)
);

ALTER TABLE internal_target ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_target: own or admin read"
  ON internal_target FOR SELECT
  USING (
    therapist_id IN (
      SELECT t.id FROM public.therapists t
      JOIN public.profiles p ON p.id = t.profile_id
      WHERE p.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "internal_target: staff create"
  ON internal_target FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "internal_target: admin approve"
  ON internal_target FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Order Metadata (Order Meta) ──────────────────────────────
CREATE TABLE IF NOT EXISTS internal_order_meta (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid NOT NULL REFERENCES public.bookings(id),
  kode_transaksi   varchar(20) NOT NULL UNIQUE,
  status_bayar     varchar(20) NOT NULL DEFAULT 'Belum Lunas'
                     CHECK (status_bayar IN ('Belum Lunas', 'Lunas')),
  catatan_admin    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE internal_order_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_order_meta: staff read"
  ON internal_order_meta FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_order_meta: staff write"
  ON internal_order_meta FOR ALL
  USING (auth.role() = 'authenticated');

-- Auto-generate transaction code trigger
CREATE OR REPLACE FUNCTION generate_trx_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
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

CREATE TRIGGER trg_trx_code
  BEFORE INSERT ON internal_order_meta
  FOR EACH ROW
  WHEN (NEW.kode_transaksi IS NULL OR NEW.kode_transaksi = '')
  EXECUTE FUNCTION generate_trx_code();

-- ── Territory Reference (Wilayah) ────────────────────────────
CREATE TABLE IF NOT EXISTS internal_wilayah (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode      varchar(20) NOT NULL UNIQUE,
  nama      varchar(200) NOT NULL,
  tipe      varchar(20) NOT NULL CHECK (tipe IN ('provinsi', 'kabupaten', 'kecamatan', 'kelurahan')),
  parent_id uuid REFERENCES internal_wilayah(id)
);

ALTER TABLE internal_wilayah ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_wilayah: staff read"
  ON internal_wilayah FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_wilayah: admin write"
  ON internal_wilayah FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Reference Data (Referensi) ───────────────────────────────
CREATE TABLE IF NOT EXISTS internal_referensi (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kunci      varchar(100) NOT NULL,
  nilai      text NOT NULL,
  tipe       varchar(50) NOT NULL,
  grup       varchar(50),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE internal_referensi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_referensi: staff read"
  ON internal_referensi FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_referensi: admin write"
  ON internal_referensi FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── App Configuration (Konfigurasi) ─────────────────────────
CREATE TABLE IF NOT EXISTS internal_konfigurasi (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kunci      varchar(100) NOT NULL UNIQUE,
  nilai      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE internal_konfigurasi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_konfigurasi: staff read"
  ON internal_konfigurasi FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_konfigurasi: admin write"
  ON internal_konfigurasi FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Seed: default configuration ─────────────────────────────
INSERT INTO internal_konfigurasi (kunci, nilai) VALUES
  ('app_name',    'TeamFGS Internal System'),
  ('app_logo',    ''),
  ('whatsapp_no', '')
ON CONFLICT (kunci) DO NOTHING;
