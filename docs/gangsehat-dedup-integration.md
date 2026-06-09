# Patient Deduplication Integration — gangsehat.com

## Context

The internal system (`internal.gangsehat.com`) and the public portal (`gangsehat.com`) share the same `patients` table in Supabase. When a patient tries to register on gangsehat.com, we need to detect if they already exist without decrypting the encrypted PII columns.

**Solution:** A `phone_hash` column — a SHA-256 hash of the normalized phone number — stored as plain text with a unique index.

---

## What the internal system already did

- Added `phone_hash text` column to `patients` with a partial unique index (`WHERE phone_hash IS NOT NULL`)
- Backfill: all existing patients have their `phone_hash` populated
- Every new patient added through the internal system sets `phone_hash` automatically

---

## What gangsehat.com needs to implement

### 1. Add `hashPhone()` utility

Create (or update) your encryption utility to include this function.
The normalization **must match exactly** for hashes to align across both apps.

```typescript
// lib/encryption.ts (or wherever your crypto utils live)
import { createHash } from 'crypto'

export function hashPhone(phone: string): string {
  const normalized = phone
    .replace(/[\s\-\(\)\.\+]/g, '')   // strip: spaces, dashes, parens, dots, leading +
    .replace(/^0/, '62')              // 08xx → 628xx (Indonesian mobile prefix)
  return createHash('sha256').update(normalized).digest('hex')
}
```

> **Important:** This must be server-side only (Node.js `crypto`). Never call it in a client component.

---

### 2. Dedup check at registration

In your patient registration server action or API route, **before inserting a new row**, check if the phone hash already exists:

```typescript
import { hashPhone } from '@/lib/encryption'
import { createClient } from '@/lib/supabase/server'

export async function registerPatient(input: { name: string; phone: string; ... }) {
  const supabase = await createClient()

  // --- Dedup check ---
  const hash = hashPhone(input.phone)
  const { data: existing } = await supabase
    .from('patients')
    .select('id')
    .eq('phone_hash', hash)
    .maybeSingle()

  if (existing) {
    // Patient already exists — return their ID or prompt login
    return { error: null, existingPatientId: existing.id, isDuplicate: true }
  }

  // --- Insert new patient ---
  const enc = encryptPatientPII({ name: input.name, phone: input.phone, ... })
  const { data, error } = await supabase.from('patients').insert({
    ...enc,
    phone_hash: hash,   // <-- set this on every insert
    gender: input.gender,
    // ... other fields
  }).select('id').single()

  return { error: error?.message ?? null, existingPatientId: data?.id ?? null, isDuplicate: false }
}
```

---

### 3. Handle the duplicate case in UI

When `isDuplicate: true` is returned, show the user a message like:

```
"Nomor HP ini sudah terdaftar. Silakan masuk ke akun Anda."
```

Or, if your app supports account linking, offer to link the registration to the existing patient record.

---

## Phone normalization rules

| Input | Normalized | Hash input |
|-------|-----------|------------|
| `0812-3456-7890` | `6281234567890` | `6281234567890` |
| `+62 812 3456 7890` | `6281234567890` | `6281234567890` |
| `081234567890` | `6281234567890` | `6281234567890` |
| `6281234567890` | `6281234567890` | `6281234567890` |

All four inputs produce the same hash. The key rules:
1. Strip all whitespace, dashes, parentheses, dots, and `+`
2. If the result starts with `0`, replace it with `62`
3. SHA-256 the result

---

## Testing the integration

1. Register a patient on gangsehat.com — check Supabase that `phone_hash` is set
2. Try registering the same phone number again — should hit the duplicate branch
3. Try variations of the same number (`0812...` vs `+62812...`) — should produce the same hash
4. A patient already imported via internal system's Excel import should also be detected as duplicate

---

## Shared ENCRYPTION_KEY

The `ENCRYPTION_KEY` environment variable must be identical in both apps for `encryptPatientPII` / `decryptPatientPII` to be interoperable. The `phone_hash` column does **not** depend on this key — it uses SHA-256 directly, so it will always match regardless of key changes.
