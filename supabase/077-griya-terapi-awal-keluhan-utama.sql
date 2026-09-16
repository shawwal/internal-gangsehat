-- Migration: Add "Keluhan Utama" (chief complaint) to Griya Anak's Terapi Awal intake.
-- Run this in the Supabase SQL editor, after 076.

ALTER TABLE public.griya_terapi_awal
  ADD COLUMN IF NOT EXISTS keluhan_utama text;
