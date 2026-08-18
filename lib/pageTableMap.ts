/**
 * Pilot mapping of nav page keys to the table(s) whose RLS is wired to the
 * same role_table_permissions lookup used by has_table_access() (see
 * supabase/063-role-table-permissions.sql). Toggling one of these pages in
 * /director/access-control also updates the underlying table's RLS access
 * for that role — not just page/sidebar visibility.
 *
 * Only roles present in role_table_permissions for a given table are
 * actually affected; toggling a role/table pair with no seeded row has no
 * effect until that table is added to the migration.
 *
 * Extending this list requires a matching migration (see the comment at
 * the top of 063-role-table-permissions.sql) — adding a page key here
 * without the DB-side policy change does nothing.
 */
export const PAGE_TABLE_MAP: Record<string, string[]> = {
  'transactions':          ['transactions'],
  'manager-transactions':  ['transactions'],
  'attendance':            ['attendance'],
  'manager-attendance':    ['attendance'],
}
