-- Add gender column to internal_profiles
-- Run this in Supabase SQL Editor

ALTER TABLE public.internal_profiles
  ADD COLUMN IF NOT EXISTS gender text
    CHECK (gender IN ('male', 'female'));
