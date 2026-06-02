-- booking_sessions: tracks individual sessions within a booking (e.g. Ke-1..Ke-N for package orders)
CREATE TABLE public.booking_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  session_number int NOT NULL,
  tanggal date,
  jam time,
  therapist_id uuid REFERENCES public.therapists(id),
  kehadiran text,
  status text NOT NULL DEFAULT 'Belum Ditangani'
    CHECK (status IN ('Belum Ditangani', 'Hadir', 'Tidak Hadir', 'Batal')),
  nominal_bayar numeric DEFAULT 0,
  metode_pembayaran text,
  keterangan text,
  catatan_admin text,
  wa_order_count int DEFAULT 0,
  wa_reminder_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(booking_id, session_number)
);

-- booking_payments: payment installment history per booking
CREATE TABLE public.booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  tanggal date NOT NULL DEFAULT CURRENT_DATE,
  nominal numeric NOT NULL,
  waktu_bayar text,
  metode text,
  catatan text,
  created_by uuid REFERENCES public.internal_profiles(id),
  created_at timestamptz DEFAULT now()
);

-- RLS: authenticated internal staff can manage both tables
ALTER TABLE public.booking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_staff_booking_sessions"
  ON public.booking_sessions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "internal_staff_booking_payments"
  ON public.booking_payments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
