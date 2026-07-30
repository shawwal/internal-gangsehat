// One-off script: copy all objects in avatars/leave-proofs/service-images
// buckets from the old Supabase project to the new one via the Storage API.
// Bucket rows + policies are already created on the new project (see
// supabase/storage-avatars.sql, supabase/034-leave-proofs-bucket.sql, and
// the service-images bucket/policies applied manually during this migration).
//
// Re-run this at final cutover time to catch any files uploaded on the old
// project since the last run (upsert:true makes it safe to re-run).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) out[m[1]] = m[2].trim()
  }
  return out
}

const oldEnv = parseEnvFile('.env')
const newEnv = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://sxcnpzrbsiyezsmtinvm.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: process.env.NEW_SERVICE_ROLE_KEY!,
}

if (!newEnv.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set NEW_SERVICE_ROLE_KEY env var before running this script.')
  process.exit(1)
}

const oldClient = createClient(oldEnv.NEXT_PUBLIC_SUPABASE_URL, oldEnv.SUPABASE_SERVICE_ROLE_KEY)
const newClient = createClient(newEnv.NEXT_PUBLIC_SUPABASE_URL, newEnv.SUPABASE_SERVICE_ROLE_KEY)

const BUCKETS = ['avatars', 'leave-proofs', 'service-images']

async function listAllPaths(bucket: string, prefix = ''): Promise<string[]> {
  const paths: string[] = []
  const { data, error } = await oldClient.storage.from(bucket).list(prefix, { limit: 1000 })
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`)
  for (const entry of data ?? []) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.id === null) {
      // folder — recurse
      paths.push(...(await listAllPaths(bucket, fullPath)))
    } else {
      paths.push(fullPath)
    }
  }
  return paths
}

async function copyBucket(bucket: string) {
  console.log(`\n=== ${bucket} ===`)
  const paths = await listAllPaths(bucket)
  console.log(`${paths.length} objects to copy`)

  let ok = 0
  let failed = 0
  for (const path of paths) {
    const { data: blob, error: dlErr } = await oldClient.storage.from(bucket).download(path)
    if (dlErr || !blob) {
      console.error(`  DOWNLOAD FAILED: ${path}: ${dlErr?.message}`)
      failed++
      continue
    }
    const { error: upErr } = await newClient.storage
      .from(bucket)
      .upload(path, blob, { upsert: true, contentType: blob.type })
    if (upErr) {
      console.error(`  UPLOAD FAILED: ${path}: ${upErr.message}`)
      failed++
      continue
    }
    ok++
  }
  console.log(`${bucket}: ${ok} copied, ${failed} failed`)
}

for (const bucket of BUCKETS) {
  await copyBucket(bucket)
}
