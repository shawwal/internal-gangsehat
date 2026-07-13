# CLAUDE.md — internal.gangsehat.com

Multi-branch clinic management: patient tracking, finance, HR, marketing. Director cross-branch view.

## Tech Stack
- Next.js 16 (App Router, `'use client'` where needed) · Supabase (PostgreSQL + Auth + RLS) · TypeScript
- Tailwind CSS v4: `@import 'tailwindcss'`; CSS vars via `var(--primary)`, not HSL tuples
- Font: Geist / Geist Mono

## Design System
Tokens in `app/globals.css` — **do not change**.
- `.glass-card` — rounded-3xl, white/10 bg, backdrop-blur-lg, border white/20. Use for all cards.
- `.glass-card-dark` — darker variant
- Primary: `#FF0090` | Secondary: `#FFB35C` | Green: `#34C759` | Destructive: `#FF3B30`
- `--radius: 2rem`

## Roles
Enum: `director | finance | hr | marketing | staff | therapist | manager | admin`

| Role      | Patients        | Finances     | HR                | Marketing    | Cross-branch |
|-----------|-----------------|--------------|-------------------|--------------|--------------|
| director  | all             | all          | all               | all          | yes          |
| finance   | read (own)      | full (own)   | —                 | —            | no           |
| hr        | —               | —            | full (own)        | —            | no           |
| marketing | —               | —            | —                 | full (own)   | no           |
| therapist | visits (own br) | —            | own only          | —            | no           |
| manager   | all (own br)    | all (own br) | all (own br)      | all (own br) | no           |
| staff     | visits (own br) | —            | own only          | —            | no           |
| admin     | all (own br)    | full (own)   | leave view-only   | —            | no           |

- **admin**: branch-scoped operational role — schedule (`patient_visits`), payments (`transactions`, same rights as `finance`), add/view patients, and view `leave_requests` for their branch. Cannot approve/reject leave — that stays `director`-only (RLS grants admin `SELECT` only on `leave_requests`).

- **director**: `branch_id = NULL` — cross-branch signal in RLS
- **manager**: branch-scoped director equivalent
- **therapist**: branch-scoped; own attendance, leave, targets, visits

## Database Schema
All tables: `id uuid PK DEFAULT gen_random_uuid()`, `created_at timestamptz DEFAULT now()`.

### Core
| Table | Key columns |
|-------|-------------|
| `branches` | name, address, phone, is_active |
| `internal_profiles` | full_name, email, phone, role, branch_id→branches, avatar_url, is_active |
| `user_notifications` | user_id, target_role, title, message, link, is_read |

### Clinical
| Table | Key columns |
|-------|-------------|
| `patients` | encrypted_name, encrypted_phone, encrypted_address, encrypted_birth_date, gender(male/female/other), is_active, no_rm(UNIQUE partial), pekerjaan, agama, hobi, kelurahan, kecamatan, kabupaten_kota, provinsi. No branch_id. PII=AES-256-GCM via `decryptPatientPII()` server-side (`lib/encryption.ts`). |
| `patient_visits` | patient_id, branch_id, visit_date, service_type, shift(PAGI/SORE), kehadiran(HADIR/TIDAK HADIR), regio, sumber_pasien, chief_complaint, diagnosis, treatment, attending_staff_id→profiles, status(scheduled/completed/cancelled/no_show), notes |

`status` = scheduling workflow; `kehadiran` = attendance record — independent fields.

### Finance
| Table | Key columns |
|-------|-------------|
| `transactions` | branch_id, patient_id, visit_id, type(income/expense), category, amount, harga, discount, outstanding(GENERATED), description, receipt_url, status(pending/confirmed/rejected), payment_method(TUNAI/TRANSFER BCA/EDC BCA), payment_status(LUNAS/DP/PELUNASAN), penjamin, fisio_id, recorded_by, confirmed_by, transaction_date |
| `branch_financial_reports` | branch_id, period_year, period_month(1-12), total_income, total_expense, net_profit(GENERATED), patient_count, visit_count, submitted_by, reviewed_by, status(draft/submitted/approved/rejected) — UNIQUE(branch_id, period_year, period_month) |

`status` = approval workflow; `payment_status` = payment detail — independent fields.

### HR
| Table | Key columns |
|-------|-------------|
| `attendance` | staff_id, branch_id, date, check_in, check_out, status(present/absent/late/leave/sick), notes, recorded_by — UNIQUE(staff_id, date) |
| `leave_requests` | staff_id, branch_id, start_date, end_date, reason, proof_url, status(pending/approved/rejected), rejection_note, reviewed_by |
| `staff_targets` | staff_id, branch_id, bulan(1-12), tahun, target_ta, target_paket_klinik, target_kunjungan, target_visit, status(pending/approved/rejected) — UNIQUE(staff_id, bulan, tahun) |

### Marketing
`campaigns`: branch_id, title, description, channel(social_media/whatsapp/email/flyer/other), start_date, end_date, budget, actual_spend, target_reach, actual_reach, status(draft/active/completed/cancelled), created_by

### Helper Functions
```sql
get_my_internal_role() → text   -- role of auth.uid()
get_my_branch()        → uuid   -- branch_id of auth.uid(); NULL for director
```

## Domain Values

**Service types** (`patient_visits.service_type`): `TERAPI AWAL` | `SESI TERAPI` | `PAKET TERAPI` | `TA VISIT` | `SESI VISIT` | `PAKET VISIT` | `LAINNYA`

**Income categories**: `TA KLINIK` | `PAKET KLINIK` | `SESI KLINIK` | `TA VISIT` | `SESI VISIT` | `PAKET VISIT` | `LAINNYA`

**Expense categories**: `BEBAN PELAYANAN` | `GAJI` | `SEWA` | `LISTRIK` | `MARKETING` | `TUKAR TUNAI` | `LAINNYA`

**Payment method**: `TUNAI` | `TRANSFER BCA` | `EDC BCA`

**Payment status**: `LUNAS` | `DP` | `PELUNASAN`

**Body regions** (regio): `HEAD` `NECK` `SHOULDER` `UPPER ARM` `ELBOW` `LOWER ARM` `WRIST` `HAND` `SPINE` `CHEST` `UPPER BACK` `LOWER BACK` `ABDOMINAL` `HIP/PELVIC` `THIGH` `KNEE` `CALF` `ANKLE` `FOOT` `CNS` `PNS` `SYSTEMIC` `CARDIOVASCULAR` `PULMONAL` `PERFORMANCE`

**Packages**: P1=5 sessions, P2=10 sessions. Completion: `LANJUT` | `SEMBUH` | `TIDAK LANJUT` | `STOP`

**Religion** (agama): `ISLAM` | `KRISTEN PROTESTAN` | `KRISTEN KATOLIK` | `HINDU` | `BUDHA` | `KONGHUCU` | `LAINNYA`

**No. RM format**: `[Initial][YY][MM][5-digit seq]` e.g. `Z0922105765`

## RLS Summary

| Table | Staff | Director |
|-------|-------|----------|
| branches | SELECT own branch | ALL |
| internal_profiles | SELECT own row; HR SELECT own branch | ALL |
| patients | SELECT all (migration 008) | ALL |
| patient_visits | ALL own branch | ALL |
| transactions | ALL own branch (finance) | ALL |
| branch_financial_reports | ALL own branch (finance) | ALL |
| attendance | SELECT own (staff); ALL own branch (hr) | ALL |
| leave_requests | ALL own rows; ALL own branch (hr) | ALL |
| staff_targets | ALL own rows | ALL |
| campaigns | ALL own branch (marketing) | ALL |
| user_notifications | SELECT user_id=uid OR target_role matches | — |

## Supabase Clients
- **Browser** (`lib/supabase/client.ts`): `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Server** (`lib/supabase/server.ts`): `createServerClient` with same keys + `cookies()` from `next/headers`

## Routes
```
app/(auth)/login/  complete-profile/
app/(dashboard)/
  layout.tsx                    ← sidebar + role guard + notifications
  director/overview/ branches/ reports/ users/ leave/ targets/
  finance/transactions/ reports/
  hr/staff/ attendance/ leave/
  marketing/campaigns/
  patients/[id]/visits/
  my-targets/  leave/  notifications/  settings/
```

## Middleware — `proxy.ts` (NOT `middleware.ts`)
- Named export `proxy`, not default export. `proxy.ts` at repo root IS the middleware.
- Do not create `middleware.ts`. Edit `proxy.ts` for auth guards/redirects.
- After login use `window.location.href` (not `router.push`) so middleware picks up session cookies.
- Public routes: `/login` `/register` `/unauthorized` `/auth/callback`
- Role redirects: `director→/director/overview` `finance→/finance/transactions` `hr→/hr/staff` `marketing→/marketing/campaigns` `manager|therapist→/patients` `staff→/pending`
- Login components: `components/login/` (ThemeToggle, BrandPanel, MobileLogo, LoginForm)
- OAuth callback: `app/auth/callback/route.ts` → `/dashboard` → proxy redirects to role home

## Key Patterns

**FK disambiguation** (multiple FKs to same table):
```ts
.select('internal_profiles!staff_id(full_name, email), branches!branch_id(name)')
```

**Server-side name/email search** (two-step):
```ts
const { data: profiles } = await supabase.from('internal_profiles')
  .select('id').or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
query = query.in('staff_id', profiles.map(p => p.id))
```

**Patient PII**: Server-only. Use `encryptPatientPII()` / `decryptPatientPII()` from `lib/encryption.ts`. Never in `'use client'` — use Server Actions in `app/actions/patients.ts`. Format: `iv:authTag:encryptedData` (hex).

**Storage cleanup**: Before deleting `leave_requests` with `proof_url`, remove from `leave-proofs` storage bucket first.

**Pagination**: `.range(from, to)` + `{ count: 'exact' }`, PAGE_SIZE = 10.

**Route collision**: `/my-targets` not `/targets` (avoids dashboard/internal group conflict).

## Modular Components
- `components/leave/` — types.ts, LeaveStats, LeaveFilters, LeaveCard, ProofDialog, ConfirmDialog, Pagination
- `components/target/` — types.ts, TargetStats, TargetFilters, TargetCard

## Design Decisions
- RLS via `get_my_branch()` scopes non-director queries at DB level — no app-level filtering.
- director `branch_id=NULL` is the cross-branch signal; director policies check role only.
- Finance submits `branch_financial_reports` monthly; director approves. Director can query raw `transactions` ad-hoc.
- No admin sub-role; director is the ceiling.

## Env Vars
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only
ENCRYPTION_KEY=                   # 32-byte hex
```
