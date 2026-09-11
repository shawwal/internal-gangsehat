/**
 * One-off backfill: re-encodes every existing file in the `avatars` storage
 * bucket (folder `avatars/<user_id>`) to a downsized WebP, matching what
 * ProfileCard now does client-side on every new upload (see
 * lib/imageCompress.ts). Also bumps the cache-busting `?t=` on each affected
 * profile's `internal_profiles.avatar_url` so browsers don't keep serving a
 * cached copy of the old bytes from the same URL.
 *
 * DRY RUN by default — prints what it would do without writing anything.
 *   npx tsx data_migrations/compress-avatars-webp.ts [--apply] [--force]
 *
 * --force also reprocesses files already stored as image/webp (useful if
 * you want to re-run with different size/quality settings).
 */

import * as fs from 'fs'
import * as path from 'path'
import sharp from 'sharp'
import { createClient } from '@supabase/supabase-js'

// ── env ──────────────────────────────────────────────────────────────────────
for (const envFile of ['../.env', '../.env.local']) {
  const p = path.join(__dirname, envFile)
  if (!fs.existsSync(p)) continue
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env/.env.local')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const FORCE = process.argv.includes('--force')

const MAX_DIMENSION = 512
const QUALITY = 85

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

async function main() {
  const { data: entries, error: listError } = await supabase.storage
    .from('avatars')
    .list('avatars', { limit: 1000, sortBy: { column: 'name', order: 'asc' } })

  if (listError) {
    console.error('Failed to list avatars bucket:', listError.message)
    process.exit(1)
  }

  const files = (entries ?? []).filter((e) => e.id !== null) // real objects, not sub-folders
  console.log(`Found ${files.length} file(s) in avatars/ ${APPLY ? '(APPLY mode)' : '(dry run — pass --apply to write)'}\n`)

  let processed = 0
  let skipped = 0
  let failed = 0
  let bytesBefore = 0
  let bytesAfter = 0

  for (const entry of files) {
    const fullPath = `avatars/${entry.name}`
    const mimetype = (entry.metadata as { mimetype?: string } | null)?.mimetype
    const originalSize = (entry.metadata as { size?: number } | null)?.size ?? 0

    if (mimetype === 'image/webp' && !FORCE) {
      console.log(`skip  ${fullPath} (already webp)`)
      skipped++
      continue
    }

    const { data: blob, error: downloadError } = await supabase.storage.from('avatars').download(fullPath)
    if (downloadError || !blob) {
      console.error(`FAIL  ${fullPath} — download error: ${downloadError?.message}`)
      failed++
      continue
    }

    const inputBuffer = Buffer.from(await blob.arrayBuffer())
    let outputBuffer: Buffer
    try {
      outputBuffer = await sharp(inputBuffer)
        .rotate() // respect EXIF orientation before stripping it
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()
    } catch (e) {
      console.error(`FAIL  ${fullPath} — encode error: ${(e as Error).message}`)
      failed++
      continue
    }

    bytesBefore += originalSize || inputBuffer.byteLength
    bytesAfter += outputBuffer.byteLength
    console.log(
      `${APPLY ? 'write' : 'would write'} ${fullPath}  ${(inputBuffer.byteLength / 1024).toFixed(0)}KB → ${(outputBuffer.byteLength / 1024).toFixed(0)}KB`,
    )

    if (APPLY) {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fullPath, outputBuffer, { upsert: true, contentType: 'image/webp' })
      if (uploadError) {
        console.error(`FAIL  ${fullPath} — upload error: ${uploadError.message}`)
        failed++
        continue
      }

      // entry.name is the profile's user id (see supabase/storage-avatars.sql policies)
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(fullPath)
      const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`
      const { error: updateError } = await supabase
        .from('internal_profiles')
        .update({ avatar_url: bustedUrl })
        .eq('id', entry.name)
      if (updateError) {
        console.error(`WARN  ${fullPath} — re-encoded but failed to bump avatar_url: ${updateError.message}`)
      }
    }

    processed++
  }

  console.log(
    `\nDone. processed=${processed} skipped=${skipped} failed=${failed}` +
      (processed > 0 ? `  total ${(bytesBefore / 1024).toFixed(0)}KB → ${(bytesAfter / 1024).toFixed(0)}KB` : ''),
  )
  if (!APPLY && processed > 0) console.log('Dry run only — re-run with --apply to write changes.')
}

main()
