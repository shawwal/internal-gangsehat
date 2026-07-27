-- Migration: drop rolling shift (Tim A / Tim B) feature — reverts 039-rolling-shift.sql
-- Run this in the Supabase SQL editor.
--
-- The rolling-shift UI, resolver logic, and jadwal-harian integration have
-- been removed from the app. This drops the underlying tables.

DROP TABLE IF EXISTS public.shift_team_members;
DROP TABLE IF EXISTS public.shift_teams;
DROP TABLE IF EXISTS public.shift_patterns;
