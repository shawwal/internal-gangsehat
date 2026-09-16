-- Guard: a `director` internal_profiles row must always have branch_id = NULL.
--
-- branch_id = NULL is the app-wide "this user is cross-branch" signal (see
-- CLAUDE.md). RLS policies already check role only, so they were never
-- affected — but app-level branch resolution (e.g. the Griya Anak hooks in
-- hooks/useGriyaBranch.ts / useGriyaJadwal.ts) reads profile.branch_id first
-- and only falls back to cross-branch behavior when it's null. A stale
-- branch_id left over from before a user was promoted to director silently
-- breaks that resolution — several pages then scope the director down to
-- their old branch instead of showing everything, which reads as "can't
-- access" the page.
--
-- This bit three real accounts: components/users/StaffTable.tsx edits Role
-- and Branch as two independent <select>s with no code tying them together,
-- so promoting someone to director there didn't clear their old branch_id.
-- That UI now clears it in the same update — this trigger is the backstop
-- so the invariant holds no matter what writes the row (any future admin
-- UI, a script, a direct SQL edit, a different role-management flow).
--
-- Run this in your Supabase SQL editor.

CREATE OR REPLACE FUNCTION public.enforce_director_branch_null()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'director' THEN
    NEW.branch_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS internal_profiles_director_branch_null ON public.internal_profiles;
CREATE TRIGGER internal_profiles_director_branch_null
  BEFORE INSERT OR UPDATE OF role, branch_id ON public.internal_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_director_branch_null();
