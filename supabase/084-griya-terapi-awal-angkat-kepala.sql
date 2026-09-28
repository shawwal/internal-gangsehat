-- Griya Anak Terapi Awal: add 'kemampuan angkat kepala' milestone
ALTER TABLE public.griya_terapi_awal
  ADD COLUMN IF NOT EXISTS usia_angkat_kepala text;
