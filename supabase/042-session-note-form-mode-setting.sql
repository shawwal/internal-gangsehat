-- Migration: session note form mode setting (single-step vs multi-step) — director-managed
-- Run this in the Supabase SQL editor.
--
-- Lets a director switch the Catatan Perawatan (SOAP) form between a single
-- one-page layout and a step-by-step wizard for all staff, without a code
-- deploy. Singleton row (id pinned to 1). RLS shape copied from
-- supabase/030-schedule-slot-settings.sql: any logged-in internal user can
-- read it, only director can update it.

create table if not exists public.session_note_settings (
  id          int primary key default 1,
  form_mode   text not null default 'single_step' check (form_mode in ('single_step', 'multi_step')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.internal_profiles(id),
  constraint session_note_settings_singleton check (id = 1)
);

alter table public.session_note_settings enable row level security;

create policy "session_note_settings_select_all"
on public.session_note_settings for select
using (get_my_internal_role() is not null);

create policy "session_note_settings_director_manage"
on public.session_note_settings for all
using (get_my_internal_role() = 'director')
with check (get_my_internal_role() = 'director');

insert into public.session_note_settings (id) values (1) on conflict (id) do nothing;
