-- RLS audit for the shared Supabase project (gangsehat + internal-gangsehat).
-- Read-only. Run in the Supabase SQL editor; every row returned is an issue.
-- Mirrors the Supabase security advisor lints that matter for RLS.

-- 1. Tables in public with RLS disabled (advisor: rls_disabled_in_public, ERROR)
SELECT 'rls_disabled' AS issue, c.relname AS object, NULL AS detail
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity

UNION ALL
-- 2. Policies exist but RLS is off (advisor: policy_exists_rls_disabled, ERROR)
SELECT DISTINCT 'policy_but_rls_off', c.relname, NULL
FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT c.relrowsecurity

UNION ALL
-- 3. Views that bypass RLS (advisor: security_definer_view, ERROR)
SELECT 'security_definer_view', c.relname, NULL
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
  AND NOT coalesce('security_invoker=true' = ANY (c.reloptions), false)

UNION ALL
-- 4. RLS on but no policies (advisor: rls_enabled_no_policy, INFO) — fine if
--    only accessed via service role / SECURITY DEFINER functions.
SELECT 'rls_on_no_policies', c.relname, NULL
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)

UNION ALL
-- 5. Permissive policies whose condition is literally true
--    (advisor: rls_policy_always_true). Expected only for public content.
SELECT 'always_true_policy', c.relname,
       p.polname || ' [' || p.polcmd::text || '] roles=' ||
       array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY (p.polroles)), ',')
FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (pg_get_expr(p.polqual, p.polrelid) = 'true'
       OR pg_get_expr(p.polwithcheck, p.polrelid) = 'true')

UNION ALL
-- 6. SECURITY DEFINER functions without a fixed search_path
--    (advisor: function_search_path_mutable, WARN)
SELECT 'function_search_path_mutable', p.proname, NULL
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg
                  WHERE cfg LIKE 'search_path=%')
ORDER BY 1, 2;
