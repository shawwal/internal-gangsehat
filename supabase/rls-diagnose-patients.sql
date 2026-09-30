-- RLS smoke test for the shared database (gangsehat + internal-gangsehat).
-- For one active user of every internal role and every public-site role,
-- SELECT from every public table/view as that user and record errors
-- (e.g. 42P17 infinite recursion, 42501 permission denied).
-- Read-only. Run the whole file in the Supabase SQL editor.
-- Result: one row per failure. Empty result = every page's reads work.

CREATE TEMP TABLE IF NOT EXISTS rls_smoke (who text, tbl text, err text);
TRUNCATE rls_smoke;

DO $$
DECLARE
  u   record;
  t   record;
  n   bigint;
BEGIN
  FOR u IN
    (SELECT DISTINCT ON (role::text) 'internal:' || role::text AS who, id
     FROM public.internal_profiles WHERE is_active)
    UNION ALL
    (SELECT DISTINCT ON (role::text) 'site:' || role::text, id
     FROM public.profiles
     WHERE id NOT IN (SELECT id FROM public.internal_profiles))
  LOOP
    FOR t IN
      SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
      WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
        AND has_table_privilege('authenticated', c.oid, 'SELECT')
      ORDER BY 1
    LOOP
      BEGIN
        PERFORM set_config('request.jwt.claims',
          json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
        SET LOCAL ROLE authenticated;
        EXECUTE format('SELECT count(*) FROM public.%I', t.relname) INTO n;
        RESET ROLE;
      EXCEPTION WHEN OTHERS THEN
        RESET ROLE;
        INSERT INTO rls_smoke VALUES (u.who, t.relname, SQLSTATE || ': ' || SQLERRM);
      END;
    END LOOP;
  END LOOP;
END $$;

SELECT * FROM rls_smoke ORDER BY tbl, who;
