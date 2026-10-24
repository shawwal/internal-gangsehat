-- Free-text description per service, edited in /director/layanan (Tarif Layanan).
ALTER TABLE public.internal_layanan
  ADD COLUMN IF NOT EXISTS deskripsi text;
