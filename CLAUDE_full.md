# CLAUDE.md — internal.gangsehat.com

Internal management system for Gangsehat clinics/branches. Multi-branch patient tracking, financial reporting, HR, and marketing — all rolled up to a director view.

## Tech Stack
- **Framework**: Next.js 16 (App Router, `'use client'` where needed)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS v4 — uses `@import 'tailwindcss'` not `@tailwind`; CSS vars via `var(--primary)` not HSL tuples
- **Language**: TypeScript
- **Font**: Geist / Geist Mono

## Design System
Design tokens, brand colors, and glass-card utilities live in `app/globals.css` — **do not change them**.

Key utilities:
- `.glass-card` — rounded-3xl, white/10 bg, backdrop-blur-lg, border white/20. Use this for all cards.
- `.glass-card-dark` — darker variant
- Primary: `#FF0090` | Secondary: `#FFB35C` | chart-4 (green): `#34C759` | destructive: `#FF3B30`
- `--radius: 2rem` — all rounded corners derive from this

## Roles
```sql
CREATE TYPE public.internal_user_role AS ENUM (
  'director', 'finance', 'hr', 'marketing', 'staff', 'therapist', 'manager'
);
```

| Role      | Patients        | Finances    | Staff/HR    | Marketing   | Cross-branch |
|-----------|-----------------|-------------|-------------|-------------|--------------|
| director  | all             | all         | all         | all         | yes          |
| finance   | read (own)      | full (own)  | —           | —           | no           |
| hr        | —               | —           | full (own)  | —           | no           |
| marketing | —               | —           | —           | full (own)  | no           |
| therapist | visits (own br) | —           | own only    | —           | no           |
| manager   | all (own br)    | all (own br)| all (own br)| all (own br)| no           |
| staff     | visits (own br) | —           | own only    | —           | no           |

- **director**: `branch_id = NULL` — cross-branch access signal in RLS
- **therapist**: branch-scoped clinical staff; falls through existing `branch_id = get_my_branch()` policies; manages own attendance, leave, targets, and patient visits
- **manager**: branch-scoped director equivalent; full access within own branch across all domains (finance, HR, marketing, clinical)

## Database Schema

All tables have `id uuid PK DEFAULT gen_random_uuid()` and `created_at timestamptz DEFAULT now()` unless noted.

### Core
| Table | Key columns |
|-------|-------------|
| `branches` | name, address, phone, is_active bool |
| `internal_profiles` | full_name, email, phone, role(user_role), branch_id→branches, avatar_url, is_active, updated_at |
| `user_notifications` | user_id→profiles, target_role(user_role), title, message, link, is_read bool |

### Clinical
| Table | Key columns |
|-------|-------------|
| `patients` | encrypted_name, encrypted_phone, encrypted_address, encrypted_birth_date, gender(male/female/other), is_active, no_rm(UNIQUE partial), pekerjaan, agama, hobi, kelurahan, kecamatan, kabupaten_kota, provinsi — **shared with gangsehat.com; no branch_id; PII encrypted AES-256-GCM. Read via `decryptPatientPII()` server-side (`lib/encryption.ts`). Internal staff access granted by migration 008 RLS policy. Plain (non-PII) fields added in migration 022.** |
| `patient_visits` | patient_id, branch_id, visit_date, service_type(TERAPI AWAL/PAKET TERAPI/SESI TERAPI/TA VISIT/SESI VISIT/PAKET VISIT/LAINNYA), shift(PAGI/SORE), kehadiran(HADIR/TIDAK HADIR), regio(body_region), sumber_pasien, chief_complaint, diagnosis, treatment, attending_staff_id→profiles, status(scheduled/completed/cancelled/no_show), notes |

**Dual-status on patient_visits**: `status` (scheduled/completed/cancelled/no_show) is the *scheduling workflow*. `kehadiran` (HADIR/TIDAK HADIR) is the *attendance record* entered by admin at time of visit — they are independent fields.

### Finance
| Table | Key columns |
|-------|-------------|
| `transactions` | branch_id, patient_id, visit_id, type(income/expense), category, amount(jumlah_bayar), harga(full_price), discount, outstanding(GENERATED=harga-amount-discount), description, receipt_url, status(pending/confirmed/rejected), rejection_reason, payment_method(TUNAI/TRANSFER BCA/EDC BCA), payment_status(LUNAS/DP/PELUNASAN), penjamin(guarantor), fisio_id→internal_profiles, recorded_by, confirmed_by, transaction_date |
| `branch_financial_reports` | branch_id, period_year, period_month(1-12), total_income, total_expense, net_profit(GENERATED), patient_count, visit_count, submitted_by, submitted_at, reviewed_by, reviewed_at, status(draft/submitted/approved/rejected), notes — UNIQUE(branch_id, period_year, period_month) |

**Dual-status on transactions**: `status` (pending/confirmed/rejected) is the *approval workflow*. `payment_status` (LUNAS/DP/PELUNASAN) is the *payment detail* — they are independent fields.

### HR
| Table | Key columns |
|-------|-------------|
| `attendance` | staff_id→profiles, branch_id, date, check_in timestamptz, check_out timestamptz, status(present/absent/late/leave/sick), notes, recorded_by — UNIQUE(staff_id, date) |
| `leave_requests` | staff_id→internal_profiles, branch_id, start_date, end_date, reason, proof_url, status(pending/approved/rejected), rejection_note, reviewed_by, reviewed_at |
| `staff_targets` | staff_id→internal_profiles, branch_id, bulan(1-12), tahun, target_ta, target_paket_klinik, target_kunjungan, target_visit, notes, status(pending/approved/rejected), reviewed_by, reviewed_at, rejection_note, updated_at — UNIQUE(staff_id, bulan, tahun) |

### Marketing
| Table | Key columns |
|-------|-------------|
| `campaigns` | branch_id, title, description, channel(social_media/whatsapp/email/flyer/other), start_date, end_date, budget, actual_spend, target_reach, actual_reach, status(draft/active/completed/cancelled), created_by |

### Helper Functions
```sql
get_my_internal_role() → text  -- SELECT role FROM internal_profiles WHERE id = auth.uid()
get_my_branch()        → uuid  -- SELECT branch_id FROM internal_profiles WHERE id = auth.uid() -- NULL for director
```

## Domain Configuration Values

These are the canonical value lists used throughout the system, derived from the clinic's Excel source data.

### Service Types (LAYANAN) — used in `patient_visits.service_type` and income `transactions.category`
| Code (Excel) | System Value | Type | Price (approx) |
|---|---|---|---|
| K.TA | `TERAPI AWAL` | Klinik | Rp 250,000 |
| K.ST | `SESI TERAPI` | Klinik | Rp 150,000 |
| K.PT Paket 1 | `PAKET TERAPI` (P1) | Klinik | Rp 650,000 (5 sesi) |
| K.PT Paket 2 | `PAKET TERAPI` (P2) | Klinik | Rp 1,200,000 (10 sesi) |
| V.TA | `TA VISIT` | Home Visit | Rp 350,000 |
| V.ST | `SESI VISIT` | Home Visit | Rp 200,000 |
| V.PT | `PAKET VISIT` | Home Visit | varies |

### Transaction Categories
**Income** (`type = 'income'`): `TA KLINIK`, `PAKET KLINIK`, `SESI KLINIK`, `TA VISIT`, `SESI VISIT`, `PAKET VISIT`, `LAINNYA`

**Expense** (`type = 'expense'`): `BEBAN PELAYANAN`, `GAJI`, `SEWA`, `LISTRIK`, `MARKETING`, `TUKAR TUNAI`, `LAINNYA`

### Payment Methods (`transactions.payment_method`)
`TUNAI` | `TRANSFER BCA` | `EDC BCA`

### Payment Detail Status (`transactions.payment_status`)
`LUNAS` (fully paid) | `DP` (down payment) | `PELUNASAN` (final/settlement payment)

### Body Regions (`patient_visits.regio`) — 26 anatomical regions
`HEAD` `NECK` `SHOULDER` `UPPER ARM` `ELBOW` `LOWER ARM` `WRIST` `HAND` `SPINE` `CHEST` `UPPER BACK` `LOWER BACK` `ABDOMINAL` `HIP/PELVIC` `THIGH` `KNEE` `CALF` `ANKLE` `FOOT` `CNS` `PNS` `SYSTEMIC` `CARDIOVASCULAR` `PULMONAL` `PERFORMANCE`

### Package Types (`patient_packages.jenis_paket`)
- `P1` — 5 sessions (t1–t5 dates)
- `P2` — 10 sessions (t1–t10 dates)

### Package Completion Status (`patient_packages.completion_status`)
`LANJUT` (continuing) | `SEMBUH` (recovered) | `TIDAK LANJUT` (discontinued) | `STOP` (stopped mid-package)

### Patient Religion Values (`patients.agama`)
`ISLAM` | `KRISTEN PROTESTAN` | `KRISTEN KATOLIK` | `HINDU` | `BUDHA` | `KONGHUCU` | `LAINNYA`

### No. RM Format (`patients.no_rm`)
Format: `[Initial][Birth year 2-digit][Month 2-digit][Sequential 5-digit]`
Example: `Z0922105765` — patient whose name starts with Z, born 09/22, record #105765.
This is the patient identifier used in clinic operations; UNIQUE partial index in DB.

## RLS Summary

| Table | Staff access | Director |
|-------|-------------|----------|
| branches | SELECT own branch | ALL |
| internal_profiles | SELECT own row; HR SELECT own branch | ALL |
| patients | SELECT all (internal staff, via migration 008 RLS) | SELECT all |
| patient_visits | ALL own branch | ALL |
| transactions | ALL own branch (finance) | ALL |
| branch_financial_reports | ALL own branch (finance) | ALL |
| attendance | SELECT own rows (staff); ALL own branch (hr) | ALL |
| leave_requests | ALL own rows (staff_id = uid); ALL own branch (hr) | ALL |
| staff_targets | ALL own rows (staff_id = uid) | ALL |
| campaigns | ALL own branch (marketing) | ALL |
| user_notifications | SELECT where user_id=uid OR target_role matches | — |

## Supabase Clients
```typescript
// lib/supabase/client.ts — for 'use client' components
import { createBrowserClient } from '@supabase/ssr'
export const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

// lib/supabase/server.ts — for server components / Route Handlers
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => ... } }
  )
}
```

## Route Structure
```
app/
  (auth)/login/  complete-profile/
  (dashboard)/
    layout.tsx              ← sidebar + role guard + notifications bell
    director/
      overview/             ← cross-branch KPIs + charts + pending targets widget
      branches/             ← CRUD branches
      reports/              ← approve/reject monthly reports
      users/                ← manage all staff & pengguna (staff/ redirects here)
      leave/                ← all leave requests: search, filter, paginate, approve/reject/delete + bulk delete
      targets/              ← all staff targets: search, filter, paginate, approve/reject/delete
    finance/
      transactions/         ← list + add + confirm
      reports/              ← generate + submit monthly report
    hr/
      staff/                ← staff list + invite
      attendance/           ← calendar + monthly summary
      leave/                ← approve/reject leave for own branch
    marketing/campaigns/    ← CRUD campaigns
    patients/[id]/visits/   ← all roles, branch-scoped by RLS
    my-targets/             ← staff submit their own monthly targets
    leave/                  ← staff submit and view own leave requests
    notifications/
    settings/
```

## Modular Components
Shared components live in `components/` (not co-located with pages):

- `components/leave/` — `types.ts`, `LeaveStats`, `LeaveFilters`, `LeaveCard`, `ProofDialog`, `ConfirmDialog`, `Pagination`
- `components/target/` — `types.ts`, `TargetStats`, `TargetFilters`, `TargetCard`

**FK disambiguation**: When a table has multiple FKs to the same table, PostgREST requires hint syntax:
```ts
.select('internal_profiles!staff_id(full_name, email), branches!branch_id(name)')
```

**Server-side name/email search** (two-step pattern used in director pages):
```ts
const { data: profiles } = await supabase.from('internal_profiles')
  .select('id').or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
const ids = profiles.map(p => p.id)
query = query.in('staff_id', ids)
```

**Patient PII encryption**: `lib/encryption.ts` provides `encryptPatientPII()` / `decryptPatientPII()` using AES-256-GCM (Node.js `crypto`, server-only). Never call these in `'use client'` components — use Server Actions in `app/actions/patients.ts` instead. Encrypted format: `iv:authTag:encryptedData` (hex). Shared `ENCRYPTION_KEY` env var works across both the internal app and gangsehat.com.

**Storage cleanup on delete**: When deleting `leave_requests` with a `proof_url`, extract the path after `/leave-proofs/` and call `supabase.storage.from('leave-proofs').remove([path])` before the DB delete. Storage bucket: `leave-proofs` (public, 5 MB max, image + PDF).

## Middleware — `proxy.ts` (not `middleware.ts`)

This project uses Next.js 16's **custom middleware file** feature. The middleware entry point is `proxy.ts` at the repo root, not the conventional `middleware.ts`.

Next.js 16 allows any filename to serve as middleware via Turbopack's module resolution — the build output confirms this: Turbopack compiles `proxy.ts` as `INNER_MIDDLEWARE_MODULE`. The `export const config = { matcher: [...] }` inside `proxy.ts` is what Next.js uses to register it as middleware.

**Key facts — do not second-guess these:**
- The middleware function is named `proxy` (not `middleware`) and is a **named export**, not a default export.
- `proxy.ts` IS the middleware. Do not create or look for `middleware.ts` — it does not exist and is not needed.
- Edit `proxy.ts` directly for any auth guards, redirects, or route protection changes.
- `window.location.href` (full reload) must be used after login — not `router.push` — so the middleware picks up the new Supabase session cookies.

**Public routes** (no auth check): `/login`, `/register`, `/unauthorized`, `/auth/callback`

**Role → home redirect** (handled inside `proxy.ts`):
```
director  → /director/overview
finance   → /finance/transactions
hr        → /hr/staff
marketing → /marketing/campaigns
manager   → /patients
therapist → /patients
staff     → /pending
```

**Login components** live in `components/login/` — `ThemeToggle`, `BrandPanel`, `MobileLogo`, `LoginForm`.  
**OAuth callback** route: `app/auth/callback/route.ts` — exchanges code → redirects to `/dashboard` → proxy redirects to role home.

## Key Design Decisions
- **Branch isolation via RLS**: `get_my_branch()` scopes all non-director queries at DB level — no app-level filtering needed.
- **Director = NULL branch_id**: absence of branch_id is the director signal; director policies check role only.
- **Monthly report as bridge**: finance submits `branch_financial_reports` per month; director approves. Director can also query raw `transactions` for ad-hoc analysis.
- **Flat four-role hierarchy**: no administrator sub-role; director is the ceiling.
- **Pagination**: use `.range(from, to)` with `{ count: 'exact' }` for server-side pagination (PAGE_SIZE = 10).
- **Route group collision**: `(dashboard)` and `(internal)` route groups both strip to same URL — check for conflicts before creating new pages. Staff target page lives at `/my-targets` (not `/targets`) to avoid conflict.

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=    # used as anon key in browser client
SUPABASE_SERVICE_ROLE_KEY=               # server-only, never expose to client
ENCRYPTION_KEY=                          # 32-byte hex, generate with: openssl rand -hex 32
```
