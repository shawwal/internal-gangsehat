# CLAUDE.md — TeamFGS Internal System
> **Read this file before writing any code.**
> This is the single source of truth for the TeamFGS internal dashboard.
> The public website (gangsehat.com) database must never be altered.

---

## Quick Start

```bash
# 1. Install UI/UX Pro Max design skill for Claude Code
npm install -g uipro-cli
uipro init --ai claude

# 2. Install project dependencies
npm install

# 3. Run the development server
npm run dev
# Opens at http://localhost:3000 → redirects to /dashboard
```

---

## 1. Project Overview

| Item | Value |
|---|---|
| **System name** | TeamFGS Internal Management System |
| **Production URL** | `https://internal.gangsehat.com` |
| **Public website** | `https://gangsehat.com` — **READ ONLY, never alter** |
| **Database** | Supabase — shared project with gangsehat.com |
| **Auth** | Supabase Auth — roles: `admin`, `manager`, `owner`, `fisioterapis` |
| **Framework** | Next.js (App Router, TypeScript strict) |
| **Styling** | Tailwind CSS |
| **Design skill** | UI/UX Pro Max — run `uipro init --ai claude` |
| **i18n** | Custom locale system — `locales/en.ts` + `locales/id.ts` |
| **Brand** | TeamFGS · Sidebar `#3D2B1F` · Gold `#D4A017` |

> **Context:** The old system ran at `dewasa.fisioterapigangsehat.id` and was built
> by a different team. This is a clean rebuild using the same Supabase database and
> the same navigation structure, deployed to `internal.gangsehat.com`.

---

## 2. Critical Rules

1. **Never DROP or ALTER** any existing table used by gangsehat.com:
   `bookings`, `patients`, `therapists`, `profiles`, `service_types`, `session_packages`,
   `blog_posts`, `gallery_videos`, `homepage_services`, `bank_accounts`, `success_stories`,
   `clinic_settings`, `dp_settings`, `service_areas`, `booking_history`, `treatment_logs`,
   `therapist_ratings`, `patient_points`, `point_transactions`, `member_type`

2. **All new tables must use the `internal_` prefix** to avoid schema conflicts.

3. **RLS must be enabled** on every new table. See `supabase/migrations/001_internal_tables.sql`.

4. **Never delete or modify existing RLS policies** on gangsehat.com tables.

5. **All queries to gangsehat.com tables are READ ONLY** unless explicitly instructed.

6. **Every UI string must use `t('key')`** — no hardcoded text in JSX.

7. **Read `design-system/MASTER.md`** before building any new page or component.

---

## 3. Project Structure

This project has **no `src/` folder** — all code lives at the root level.

```
interal-gangsehat/
├── app/                        Next.js App Router pages
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (internal)/             Route group — shared Sidebar + Header layout
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── order/
│   │   │   ├── page.tsx
│   │   │   └── packages/page.tsx
│   │   ├── master/
│   │   │   ├── tester/page.tsx
│   │   │   ├── positions/page.tsx
│   │   │   ├── patients/page.tsx
│   │   │   ├── services/page.tsx
│   │   │   ├── shifts/page.tsx
│   │   │   ├── schedules/page.tsx
│   │   │   ├── territories/page.tsx
│   │   │   └── users/page.tsx
│   │   ├── leave/page.tsx
│   │   ├── targets/page.tsx
│   │   ├── schedules/
│   │   │   ├── page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   └── today/page.tsx
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   ├── daily/page.tsx
│   │   │   └── targets/page.tsx
│   │   └── settings/
│   │       ├── references/page.tsx
│   │       ├── roles/page.tsx
│   │       ├── permissions/page.tsx
│   │       └── configuration/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                Redirects to /dashboard
├── components/
│   └── internal/
│       ├── AppShell.tsx
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       ├── PageHeader.tsx
│       ├── StatusBadge.tsx
│       ├── BlankPage.tsx
│       ├── DataTable.tsx
│       └── index.ts
├── config/
│   ├── navigation.ts           Single source of truth for all routes + icons
│   └── i18n.ts
├── context/
│   └── LocaleContext.tsx
├── hooks/
│   ├── useTranslation.ts
│   ├── useAuth.ts
│   └── usePagination.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── internal/
│   │   └── formatters.ts
│   └── utils.ts
├── locales/
│   ├── en.ts                   English — defines all keys + types
│   ├── id.ts                   Indonesian — mirrors en.ts exactly
│   └── index.ts
├── types/
│   └── index.ts
├── supabase/
│   └── migrations/
│       └── 001_internal_tables.sql
├── proxy.ts
├── navigation.ts               (root-level copy for Claude Code convenience)
├── en.ts                       (root-level copy for Claude Code convenience)
├── .env.local
├── CLAUDE.md
└── tsconfig.json
```

---

## 4. Path Aliases (tsconfig.json)

```ts
// All aliases resolve from the project root — no src/ prefix
"@/*" → "./*"

// Usage examples:
import { useTranslation } from '@/hooks/useTranslation'
import { DataTable }       from '@/components/internal/DataTable'
import { navigation }      from '@/config/navigation'
import en                  from '@/locales/en'
```

---

## 5. Route Map

All internal pages live in `app/(internal)/`.
The `(internal)/layout.tsx` applies the Sidebar + Header shell to all of them.

```
/login                           Login page

/dashboard                       Dashboard / welcome screen
/order                           Order list (all transactions)
/order/packages                  Orders grouped by active package

/master/tester                   Tester — key-value lookup tool
/master/positions                Positions (Owner, Manager, Admin, Physiotherapist)
/master/patients                 Patient records
/master/services                 Services (packages and sessions)
/master/shifts                   Shift hour slots (Morning / Afternoon)
/master/schedules                Master schedule template (physio × day × shift)
/master/territories              Indonesian territory reference data
/master/users                    System user accounts

/leave                           Leave requests
/targets                         Monthly targets per physiotherapist

/schedules                       Generated schedule list
/schedules/calendar              Calendar view
/schedules/today                 Today's schedule with attendance

/reports                         Statistics — charts and KPIs
/reports/daily                   Daily report (Morning / Afternoon breakdown)
/reports/targets                 Target report — matrix: category × day of month

/settings/references             Reference data — key-value lookup table
/settings/roles                  Role management
/settings/permissions            Permission management (149 entries)
/settings/configuration          App configuration (name, logo, contact)
```

Navigation config: `config/navigation.ts` — single source of truth for all
routes, Lucide icon names, and role visibility rules.

---

## 6. i18n System

### How it works
```
locales/
  en.ts          English — default, defines all keys and TypeScript types
  id.ts          Indonesian — mirrors en.ts structure exactly
  index.ts       Exports getTranslations(), Locale type, supportedLocales

context/
  LocaleContext.tsx   React context — persists chosen locale in localStorage

hooks/
  useTranslation.ts   Convenience alias for useLocale()
```

### Usage in any component
```tsx
import { useTranslation } from '@/hooks/useTranslation'

export function MyComponent() {
  const { t } = useTranslation()
  return <h1>{t('nav.dashboard')}</h1>
}
```

### Switching locale
The `<Header />` has a built-in language switcher (EN / ID).
Locale is stored in `localStorage` under the key `teamfgs_locale`.
Default locale: `'id'`.

### Adding a new translation key
1. Add the key + English value to `locales/en.ts`
2. Add the matching Indonesian value to `locales/id.ts`
3. TypeScript will error if `id.ts` is missing the key

---

## 7. Database

### 7.1 Protected gangsehat.com tables — READ ONLY

```sql
public.profiles          id, email, full_name, phone, role
                         role: 'patient' | 'admin' | 'therapist'

public.patients          id, profile_id, encrypted_name, encrypted_phone,
                         gender, blood_type, member_type_id

public.therapists        id, profile_id, specializations[], is_available,
                         working_hours (jsonb), average_rating

public.bookings          id, patient_id, therapist_id, service_type,
                         scheduled_date, scheduled_time, status,
                         estimated_price, discounted_price, payment_method
                         status: waiting_confirmation | confirmed |
                                 in_progress | completed | cancelled

public.service_types     id, name, price, duration_minutes, is_active
public.session_packages  id, name, points_count, price, is_active
public.patient_points    id, patient_id, total_points, used_points
public.point_transactions id, patient_id, points_change, type, booking_id
public.treatment_logs    id, booking_id, therapist_id, symptoms, diagnosis
public.booking_history   id, booking_id, previous_status, new_status
public.therapist_ratings id, therapist_id, patient_id, booking_id, rating
public.blog_posts, gallery_videos, homepage_services, success_stories,
public.bank_accounts, service_areas, clinic_settings, dp_settings
```

### 7.2 New internal tables (prefix: `internal_`)

Full DDL + RLS policies: `supabase/migrations/001_internal_tables.sql`

> The DB column names are Indonesian (they match the existing system).
> TypeScript types in `types/index.ts` use English property names with a
> comment noting the raw DB column name where it differs.

```
internal_jabatan           Positions
internal_users             Staff linked to profiles
internal_layanan           Extended service definitions
internal_jam_shift         Shift time slots (Morning / Afternoon)
internal_master_jadwal     Schedule template per physio per day
internal_jadwal            Generated daily schedules
internal_cuti              Leave requests
internal_target            Monthly targets
internal_order_meta        Order metadata (transaction codes, payment status)
internal_wilayah           Territory reference data
internal_referensi         Key-value reference data
internal_konfigurasi       App configuration
```

### 7.3 Raw DB status values

These are stored as-is in the DB. The UI always displays translated labels
via `StatusBadge` and the `status.*` locale keys.

| DB Value | English label | Indonesian label |
|---|---|---|
| `waiting_confirmation` | Booking | Booking |
| `confirmed` | Processing | Proses |
| `in_progress` | Processing | Proses |
| `completed` | Completed | Selesai |
| `cancelled` | Cancelled | Batal |
| `Belum Lunas` | Unpaid | Belum Lunas |
| `Lunas` | Paid | Lunas |
| `TERSEDIA` | Available | Tersedia |
| `OFF` | Off Duty | OFF |
| `CUTI` | On Leave | Cuti |
| `MASUK` | Present | Masuk |
| `MENUNGGU` | Pending | Menunggu |
| `DISETUJUI` | Approved | Disetujui |
| `DITOLAK` | Rejected | Ditolak |
| `PAGI` | Morning | Pagi |
| `SORE` | Afternoon | Sore |

---

## 8. Business Logic

### Transaction code format
```
TRX/YYYY/MM/NNNN  →  e.g. TRX/2026/04/0317
Auto-generated by a Postgres trigger on the internal_order_meta table.
```

### Shift hours
```
Morning (PAGI)    →  09:00 – 14:30  (30-minute slots)
Afternoon (SORE)  →  15:00 – 21:00  (30–60-minute slots)
```

### Patient RM code format
```
[First letter of name][DDMM][sequence]
Example: D2604118 = name starts with D, April 26, sequence 118
```

### Daily report structure
Four sections: Visit counts · Completed packages · Revenue · Transaction totals
Tabs: Morning / Afternoon — filtered by booking shift

### Target report matrix
Columns: Category | Target | Achieved | Difference | Progress % | Day 1 … 31
Categories: Initial Therapy · Clinic Packages · Visits · Home Visit Packages

---

## 9. Access Control

| Feature | Physio | Admin | Manager | Owner |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Order list (see amounts) | ❌ | ✅ | ✅ | ✅ |
| Update attendance | ✅ | ✅ | ✅ | ✅ |
| Mark order paid | ✅ | ✅ | ✅ | ✅ |
| Stop / pause order | ✅ | ✅ | ✅ | ✅ |
| Send WhatsApp reminder | ✅ | ✅ | ✅ | ✅ |
| Master Data | ❌ | ✅ | ✅ | ✅ |
| Submit own leave | ✅ | ✅ | ✅ | ✅ |
| Approve leave | ❌ | ✅ | ✅ | ✅ |
| Submit own target | ✅ | ✅ | ✅ | ✅ |
| Approve target | ❌ | ✅ | ✅ | ✅ |
| Generate schedule | ❌ | ✅ | ✅ | ✅ |
| Statistics report | ❌ | ✅ | ✅ | ✅ |
| Daily report | ✅ | ✅ | ✅ | ✅ |
| Target report | own only | all | ✅ | ✅ |
| Settings | ❌ | ✅ | ✅ | ✅ |

---

## 10. Design System

> Run `uipro init --ai claude` to install the full UI/UX Pro Max skill.
> Always read `design-system/MASTER.md` before building a new page.

### Colors (CSS variables in `app/globals.css`)
```css
--color-sidebar-bg:    #3D2B1F   dark brown sidebar
--color-sidebar-text:  #F5ECD7   cream text
--color-brand-gold:    #D4A017   gold — active nav + primary buttons
--color-page-bg:       #F4F5F7   light grey content area
--color-header-bg:     #FFFFFF   white top bar
```

### Typography
```
Sora            display / brand / headings
DM Sans         body / tables / forms
JetBrains Mono  transaction codes / keys / monospace data
```

### Layout
```
Sidebar expanded    220px
Sidebar collapsed    64px
Header height        56px
Content padding      p-6 (24px)
Card radius          rounded-2xl
Button radius        rounded-xl
Default rows/page    10
```

---

## 11. Component Architecture

```
components/internal/
  AppShell.tsx      Root shell — Sidebar + Header + content area
  Sidebar.tsx       Collapsible nav driven by config/navigation.ts
  Header.tsx        Language switcher + user menu
  PageHeader.tsx    Page title + breadcrumb + action buttons
  StatusBadge.tsx   Colored badge for any status value
  BlankPage.tsx     Phase-1 stub used by all placeholder pages
  DataTable.tsx     Generic paginated table
  index.ts          Barrel export
```

### Standard page pattern (Phase 1)
```tsx
'use client'
import { useTranslation } from '@/hooks/useTranslation'
import { BlankPage } from '@/components/internal/BlankPage'

export default function MyPage() {
  const { t } = useTranslation()
  return (
    <BlankPage
      title={t('page.section.title')}
      breadcrumb={t('nav.section')}
    />
  )
}
```

---

## 12. Phase Plan

### ✅ Phase 1 — Shell + all stub pages (complete)
- [x] i18n system — `locales/en.ts`, `locales/id.ts`, LocaleContext, useTranslation
- [x] Navigation config — `config/navigation.ts` with fully English routes
- [x] AppShell — collapsible Sidebar + Header with language switcher
- [x] All 23 pages as stubs under `app/(internal)/`
- [x] Login page with Supabase auth
- [x] Auth middleware — protects all internal routes
- [x] Supabase client + server helpers
- [x] TypeScript types for all DB tables
- [x] DataTable component with pagination
- [x] SQL migration for all `internal_` tables

### 🔲 Phase 2 — Order module
- [ ] Order list table with live Supabase data
- [ ] Packages view
- [ ] Order detail side panel
- [ ] Actions: mark paid, stop, attend, send WhatsApp

### 🔲 Phase 3 — Master Data
- [ ] Patients list + search
- [ ] Services CRUD
- [ ] Positions, Shift Hours, Schedule generator
- [ ] Territories search, Users, Tester

### 🔲 Phase 4 — Schedules & Leave
- [ ] Schedule list + calendar view
- [ ] Today's schedule with attendance toggle
- [ ] Leave requests with photo upload

### 🔲 Phase 5 — Reports & Targets
- [ ] Statistics charts
- [ ] Daily report with Morning / Afternoon tabs
- [ ] Target matrix report

### 🔲 Phase 6 — Settings
- [ ] Roles and permissions management
- [ ] Reference data CRUD
- [ ] App configuration form

---

## 13. Environment Variables

```env
# .env.local — never commit this file

# Supabase — same project as gangsehat.com
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# App
NEXT_PUBLIC_APP_NAME="TeamFGS Internal System"
NEXT_PUBLIC_BASE_URL="https://internal.gangsehat.com"
NEXT_PUBLIC_DEFAULT_LOCALE="id"
```

---

## 14. Pre-Push Checklist

- [ ] No DROP TABLE or ALTER TABLE on gangsehat.com tables
- [ ] All new tables have the `internal_` prefix
- [ ] RLS enabled on every new table
- [ ] All UI strings use `t('key')` — zero hardcoded text in JSX
- [ ] Transaction codes formatted `TRX/YYYY/MM/NNNN`
- [ ] Role checks match the table in Section 9
- [ ] No API keys or secrets in source code
- [ ] Read `design-system/MASTER.md` before any new UI work

---

*Last updated: April 21, 2026 · Production: internal.gangsehat.com · Stack: Next.js + Supabase + Tailwind*