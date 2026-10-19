/**
 * Singkawang therapist accounts for the FISIOTERAPI.xlsx history import.
 *
 *   npx tsx scripts/create-singkawang-therapists.mts             # create / promote accounts
 *   DEACTIVATE=1 npx tsx scripts/create-singkawang-therapists.mts # deactivate the former therapists
 *
 * - ARA is active and already signed in with Google (pending 'staff', no branch) → promoted
 *   to therapist @ Singkawang. Google login, so no password is set.
 * - Former therapists get <name>@gangsehat.com with a generated password, so their imported
 *   visits can be attributed. DEACTIVATE mirrors deleteInternalUser() in
 *   app/actions/delete-user.ts: ban the auth user + is_active = false (history is kept).
 * Generated credentials are printed once and written to CREDENTIALS_FILE (outside the repo).
 */

import { randomBytes } from 'crypto'
import { writeFileSync } from 'fs'
import { SINGKAWANG_BRANCH_ID as BRANCH, createAdmin } from './lib/singkawang.mjs'

const DEACTIVATE = process.env.DEACTIVATE === '1'
const CREDENTIALS_FILE = process.env.CREDENTIALS_FILE

const ACTIVE = [{ name: 'Ara Ariska', email: 'araariska12@gmail.com' }]
// IBNU in the sheet is the active therapist Muhammad Ibnu Nazar — not a former one
const FORMER = ['Meme', 'Afifah', 'Qusay', 'Ayi', 'Shodiq', 'Nona', 'Taufik']
  .map(name => ({ name, email: `${name.toLowerCase()}@gangsehat.com` }))

const supabase = createAdmin()

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find(u => u.email?.toLowerCase() === email)
    if (hit) return hit.id
    if (data.users.length < 200) break
  }
  return null
}

function generatePassword(): string {
  // 16 chars, unambiguous alphabet
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return Array.from(randomBytes(16), b => alphabet[b % alphabet.length]).join('')
}

async function makeTherapist(id: string, name: string) {
  // The auth trigger already created internal_profiles (role 'staff', branch NULL) —
  // stamp role + branch like inviteStaffByHR() does.
  const { data, error } = await supabase.from('internal_profiles')
    .update({ role: 'therapist', branch_id: BRANCH, full_name: name, is_active: true })
    .eq('id', id).select('role, branch_id').single()
  if (error) throw new Error(`${name}: ${error.message}`)
  if (data.role !== 'therapist' || data.branch_id !== BRANCH) throw new Error(`${name}: role/branch not saved`)
}

async function create() {
  const credentials: string[] = []

  for (const t of ACTIVE) {
    const id = await findUserId(t.email)
    if (!id) throw new Error(`${t.email} has no account yet — ask her to sign in once first`)
    await makeTherapist(id, t.name)
    console.log(`✅ ${t.name} <${t.email}> → therapist @ Singkawang (Google login)`)
  }

  for (const t of FORMER) {
    let id = await findUserId(t.email)
    if (id) {
      console.log(`↷  ${t.email} already exists — role/branch refreshed, password unchanged`)
    } else {
      const password = generatePassword()
      const { data, error } = await supabase.auth.admin.createUser({
        email: t.email, password, email_confirm: true, user_metadata: { full_name: t.name },
      })
      if (error) throw new Error(`${t.email}: ${error.message}`)
      id = data.user.id
      credentials.push(`${t.name}\t${t.email}\t${password}`)
      console.log(`✅ ${t.name} <${t.email}> created`)
    }
    await makeTherapist(id, t.name)
  }

  if (credentials.length) {
    const text = ['name\temail\tpassword', ...credentials].join('\n') + '\n'
    if (CREDENTIALS_FILE) writeFileSync(CREDENTIALS_FILE, text, { mode: 0o600 })
    console.log(`\n🔑 Generated credentials${CREDENTIALS_FILE ? ` (saved to ${CREDENTIALS_FILE})` : ''}:\n${text}`)
  }
}

async function deactivate() {
  for (const t of FORMER) {
    const id = await findUserId(t.email)
    if (!id) { console.log(`↷  ${t.email} not found`); continue }
    const { error: banError } = await supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' })
    if (banError) throw new Error(`${t.email}: ${banError.message}`)
    const { error } = await supabase.from('internal_profiles').update({ is_active: false }).eq('id', id)
    if (error) throw new Error(`${t.email}: ${error.message}`)
    console.log(`⏸  ${t.name} <${t.email}> deactivated`)
  }
}

;(DEACTIVATE ? deactivate() : create()).catch(e => { console.error(e); process.exit(1) })
