/**
 * Create a NORMAL director test account for QA / system checks.
 *
 * This account is a regular director in every respect:
 *   - it appears in the director list like any other director,
 *   - its actions are recorded in the activity log like any other user's,
 *   - it signs in through the normal login page with email + password.
 *
 * It is just a convenience account you can delete when you are done
 * (Staff & Pengguna → Nonaktif, or re-run with DELETE=1).
 *
 * Usage:
 *   EMAIL=qa.director@gangsehat.com PASSWORD='choose-a-strong-one' \
 *     npx tsx scripts/create-director-test-account.mts
 *
 *   # optional: NAME='QA Director'
 *   # remove it again:
 *   EMAIL=qa.director@gangsehat.com DELETE=1 \
 *     npx tsx scripts/create-director-test-account.mts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const envRaw = readFileSync(join(__dirname, '../.env.local'), 'utf8')
const env: Record<string, string> = {}
for (const line of envRaw.split('\n')) {
  const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}

const SUPABASE_URL     = env['NEXT_PUBLIC_SUPABASE_URL']  ?? ''
const SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}

const EMAIL    = process.env.EMAIL?.trim()
const PASSWORD = process.env.PASSWORD
const NAME     = process.env.NAME?.trim() || 'QA Director'
const DELETE   = process.env.DELETE === '1'

if (!EMAIL) {
  console.error('Set EMAIL=... (and PASSWORD=... unless DELETE=1)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(email: string) {
  // listUsers is paged; this project has few internal users, so a scan is fine.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  const existing = await findUserByEmail(EMAIL!)

  if (DELETE) {
    if (!existing) { console.log('No auth user with that email — nothing to delete.'); return }
    // internal_profiles.id → auth.users(id); removing the auth user cascades
    // only if the FK is ON DELETE CASCADE, so clear the profile row first.
    await supabase.from('internal_profiles').delete().eq('id', existing.id)
    const { error } = await supabase.auth.admin.deleteUser(existing.id)
    if (error) throw error
    console.log(`Deleted test director account: ${EMAIL}`)
    return
  }

  if (!PASSWORD || PASSWORD.length < 8) {
    console.error('Set PASSWORD=... (at least 8 characters)')
    process.exit(1)
  }

  let userId: string
  if (existing) {
    userId = existing.id
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: NAME },
    })
    if (error) throw error
    console.log(`Updated existing auth user: ${EMAIL}`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: NAME },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`Created auth user: ${EMAIL}`)
  }

  // Normal director profile: branch_id NULL is the cross-branch signal, and the
  // enforce_director_branch_null trigger keeps it NULL regardless.
  const { error: profErr } = await supabase
    .from('internal_profiles')
    .upsert(
      {
        id: userId,
        email: EMAIL,
        full_name: NAME,
        role: 'director',
        branch_id: null,
        is_active: true,
      },
      { onConflict: 'id' },
    )
  if (profErr) throw profErr

  console.log('\nDone. A normal, visible, fully-logged director account is ready.')
  console.log(`  Login at the normal /login page:`)
  console.log(`    email:    ${EMAIL}`)
  console.log(`    password: (the one you set)`)
  console.log(`\nDelete it when finished:`)
  console.log(`  EMAIL=${EMAIL} DELETE=1 npx tsx scripts/create-director-test-account.mts`)
}

main().catch((e) => { console.error(e); process.exit(1) })
