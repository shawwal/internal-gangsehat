# CLAUDE.md — internal.gangsehat.com

Internal management system for Gangsehat clinics/branches. Handles multi-branch patient tracking, financial reporting, HR, and marketing — all rolled up to a director view.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Font**: Geist / Geist Mono
- **Language**: TypeScript

---

## Design System

Copy this exactly into `app/globals.css`. Colors and glass effects are taken directly from gangsehat.com — do not change them.

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

:root {
  /* Gangsehat Brand Colors */
  --primary-pink: #FF0090;
  --primary-pink-light: #FFB3D9;
  --secondary-orange: #FFB35C;
  --background-light: #F8F8F8;
  --card-bg: #FFFFFF;
  --text-dark: #1D1D1D;
  --text-gray: #666666;
  --border-gray: #E8E8E8;

  /* Shadcn tokens */
  --background: #F8F8F8;
  --foreground: #1D1D1D;
  --card: #FFFFFF;
  --card-foreground: #1D1D1D;
  --popover: #FFFFFF;
  --popover-foreground: #1D1D1D;
  --primary: #FF0090;
  --primary-foreground: #FFFFFF;
  --secondary: #FFB35C;
  --secondary-foreground: #1D1D1D;
  --muted: #F0F0F0;
  --muted-foreground: #999999;
  --accent: #FF0090;
  --accent-foreground: #FFFFFF;
  --destructive: #FF3B30;
  --destructive-foreground: #FFFFFF;
  --border: #E8E8E8;
  --input: #F0F0F0;
  --ring: #FF0090;
  --chart-1: #FF0090;
  --chart-2: #FFB35C;
  --chart-3: #00C7BE;
  --chart-4: #34C759;
  --chart-5: #007AFF;
  --radius: 2rem;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #1D1D1D;
  --sidebar-primary: #FF0090;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #FFB35C;
  --sidebar-accent-foreground: #1D1D1D;
  --sidebar-border: #E8E8E8;
  --sidebar-ring: #FF0090;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: #FF0090;
  --primary-foreground: #FFFFFF;
  --secondary: #FFB35C;
  --secondary-foreground: #1D1D1D;
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: #FF0090;
  --accent-foreground: #FFFFFF;
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.637 0.237 25.331);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: #FF0090;
  --chart-1: #FF0090;
  --chart-2: #FFB35C;
  --chart-3: #00C7BE;
  --chart-4: #34C759;
  --chart-5: #007AFF;
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: #FF0090;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #FFB35C;
  --sidebar-accent-foreground: #1D1D1D;
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: #FF0090;
}

@theme inline {
  --font-sans: 'Geist', 'Geist Fallback';
  --font-mono: 'Geist Mono', 'Geist Mono Fallback';
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Glass Card Components */
.glass-card {
  @apply rounded-3xl border border-white/20 bg-white/10 backdrop-blur-lg
         dark:border-white/10 dark:bg-white/5 transition-all duration-300;
}

.glass-card:hover {
  @apply border-white/30 dark:border-white/20;
}

.glass-card-dark {
  @apply rounded-3xl border border-white/10 bg-white/5 backdrop-blur-lg
         dark:border-white/10 dark:bg-black/20;
}

/* Gradient text animation */
@keyframes gradient {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}

.animate-gradient {
  background-size: 200% 200%;
  animation: gradient 6s ease infinite;
}

/* Float animation */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-10px); }
}

.animate-float {
  animation: float 3s ease-in-out infinite;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Hide scrollbar */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

---

## Roles

```sql
CREATE TYPE public.user_role AS ENUM (
  'director',   -- full read/write across all branches
  'finance',    -- financial records + reports; own branch only
  'hr',         -- staff management + attendance; own branch only
  'marketing'   -- campaigns + promos; own branch only
);
```

### Role Capabilities

| Role      | Patients     | Finances     | Staff/HR     | Marketing    | Cross-branch |
|-----------|-------------|-------------|-------------|-------------|-------------|
| director  | all branches | all branches | all branches | all branches | yes         |
| finance   | read (own)   | full (own)   | —           | —           | no          |
| hr        | —           | —           | full (own)   | —           | no          |
| marketing | —           | —           | —           | full (own)   | no          |

---

## Feature Plan

### 1. Authentication & Profile
- Supabase Auth (email + password)
- Profile: `full_name`, `role`, `branch_id`, `avatar_url`, `phone`
- On first login → complete profile wizard
- Role guard middleware redirects to role-specific dashboard

### 2. Director Dashboard (`/director`)
- **Overview**: cross-branch KPI cards — total patients, total revenue, total expenses, net profit, active staff
- **Branch comparison**: bar chart of revenue/expense per branch, filterable by month/year
- **Financial reports inbox**: list of submitted monthly reports from all branches; approve or reject with notes
- **Branch management**: CRUD for branches (name, address, phone, is_active)
- **Staff management**: view all staff across branches, change role, deactivate, assign to branch
- **Audit log**: read-only feed of all significant actions (report submitted, transaction confirmed, staff added)

### 3. Finance Module (`/finance`)
- **Transaction list**: paginated table of income/expense for own branch; filter by type, category, date range, status
- **Add transaction**: form with type, category, amount, description, receipt upload, transaction date, optional patient link
- **Confirm/reject transactions**: finance confirms pending transactions; rejected ones require a reason
- **Monthly report**: generate summary for a given month — auto-aggregates transactions; add notes; submit to director
- **Report history**: list of past submitted reports and their approval status

### 4. HR Module (`/hr`)
- **Staff list**: table of all staff in own branch; search by name/role; deactivate
- **Add staff**: invite by email (triggers Supabase Auth invite); assign role + branch
- **Attendance**: calendar view per staff member; mark present/absent/late/leave/sick
- **Attendance summary**: monthly table showing attendance stats per staff
- **Leave requests** *(optional v2)*: staff submit, HR approves

### 5. Marketing Module (`/marketing`)
- **Campaign list**: CRUD for campaigns for own branch; filter by status/channel/date
- **Campaign detail**: title, description, channel, dates, budget vs actual spend, target vs actual reach
- **Campaign status flow**: draft → active → completed / cancelled
- **Analytics summary**: simple cards — total campaigns, total budget spent, avg reach

### 6. Patient Module (`/patients`) — all roles, branch-scoped by RLS
- **Patient list**: search by name, MRN, phone; filter by is_active
- **Patient detail**: demographics, visit history, linked transactions
- **Add/edit patient**: form with full_name, DOB, gender, phone, email, address, medical_record_number
- **Visit log**: add/edit visits (date, complaint, diagnosis, treatment, status, attending staff)

### 7. Notifications
- In-app alerts for:
  - Director: new report submitted for review
  - Finance: transaction confirmed/rejected by director
  - HR: new staff added to branch
- Stored in `user_notifications` table; marked read on click

### 8. Settings (`/settings`)
- Update own profile (name, phone, avatar)
- Change password
- Director only: platform-wide settings (branch list, role management)

---

## Database Schema

```sql
-- Branches
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profiles (linked to Supabase Auth)
-- branch_id = NULL → director (all-branch access)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  role user_role NOT NULL DEFAULT 'marketing',
  branch_id uuid REFERENCES public.branches(id),
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Patients
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  full_name text NOT NULL,
  date_of_birth date,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  phone text,
  email text,
  address text,
  medical_record_number text UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Patient visits
CREATE TABLE public.patient_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  chief_complaint text,
  diagnosis text,
  treatment text,
  attending_staff_id uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Financial transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  patient_id uuid REFERENCES public.patients(id),
  visit_id uuid REFERENCES public.patient_visits(id),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  amount numeric NOT NULL,
  description text,
  receipt_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  rejection_reason text,
  recorded_by uuid REFERENCES public.profiles(id),
  confirmed_by uuid REFERENCES public.profiles(id),
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Monthly branch financial reports (branch → director)
CREATE TABLE public.branch_financial_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  period_year integer NOT NULL,
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  total_income numeric NOT NULL DEFAULT 0,
  total_expense numeric NOT NULL DEFAULT 0,
  net_profit numeric GENERATED ALWAYS AS (total_income - total_expense) STORED,
  patient_count integer NOT NULL DEFAULT 0,
  visit_count integer NOT NULL DEFAULT 0,
  submitted_by uuid REFERENCES public.profiles(id),
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (branch_id, period_year, period_month)
);

-- Staff attendance
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.profiles(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  status text NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'late', 'leave', 'sick')),
  notes text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE (staff_id, date)
);

-- Marketing campaigns
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  title text NOT NULL,
  description text,
  channel text CHECK (channel IN ('social_media', 'whatsapp', 'email', 'flyer', 'other')),
  start_date date,
  end_date date,
  budget numeric DEFAULT 0,
  actual_spend numeric DEFAULT 0,
  target_reach integer,
  actual_reach integer,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- In-app notifications
CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),
  target_role user_role,
  title text NOT NULL,
  message text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### Helper Functions

```sql
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- Returns NULL for director → means: no branch restriction
CREATE OR REPLACE FUNCTION get_my_branch()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;
```

---

## RLS Policies

```sql
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
```

### Branches
```sql
CREATE POLICY "Director manages branches" ON public.branches
  FOR ALL USING (get_my_role() = 'director') WITH CHECK (get_my_role() = 'director');

CREATE POLICY "Staff reads own branch" ON public.branches
  FOR SELECT USING (id = get_my_branch() OR get_my_role() = 'director');
```

### Profiles
```sql
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK ((auth.uid() = id) AND (role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())));

CREATE POLICY "Director manages all profiles" ON public.profiles
  FOR ALL USING (get_my_role() = 'director') WITH CHECK (get_my_role() = 'director');

CREATE POLICY "HR reads branch profiles" ON public.profiles
  FOR SELECT USING (get_my_role() = 'hr' AND branch_id = get_my_branch());

CREATE POLICY "Enable insert for auth users" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
```

### Patients
```sql
CREATE POLICY "Director manages all patients" ON public.patients
  FOR ALL USING (get_my_role() = 'director') WITH CHECK (get_my_role() = 'director');

CREATE POLICY "Branch staff manages own patients" ON public.patients
  FOR ALL
  USING (branch_id = get_my_branch() AND get_my_role() IN ('finance', 'hr', 'marketing'))
  WITH CHECK (branch_id = get_my_branch() AND get_my_role() IN ('finance', 'hr', 'marketing'));
```

### Transactions
```sql
CREATE POLICY "Director manages all transactions" ON public.transactions
  FOR ALL USING (get_my_role() = 'director') WITH CHECK (get_my_role() = 'director');

CREATE POLICY "Finance manages own branch transactions" ON public.transactions
  FOR ALL
  USING (get_my_role() = 'finance' AND branch_id = get_my_branch())
  WITH CHECK (get_my_role() = 'finance' AND branch_id = get_my_branch());
```

### Branch Financial Reports
```sql
CREATE POLICY "Director manages all reports" ON public.branch_financial_reports
  FOR ALL USING (get_my_role() = 'director') WITH CHECK (get_my_role() = 'director');

CREATE POLICY "Finance manages own branch reports" ON public.branch_financial_reports
  FOR ALL
  USING (get_my_role() = 'finance' AND branch_id = get_my_branch())
  WITH CHECK (get_my_role() = 'finance' AND branch_id = get_my_branch());
```

### Attendance
```sql
CREATE POLICY "Director manages all attendance" ON public.attendance
  FOR ALL USING (get_my_role() = 'director') WITH CHECK (get_my_role() = 'director');

CREATE POLICY "HR manages own branch attendance" ON public.attendance
  FOR ALL
  USING (get_my_role() = 'hr' AND branch_id = get_my_branch())
  WITH CHECK (get_my_role() = 'hr' AND branch_id = get_my_branch());

CREATE POLICY "Staff views own attendance" ON public.attendance
  FOR SELECT USING (staff_id = auth.uid());
```

### Campaigns
```sql
CREATE POLICY "Director manages all campaigns" ON public.campaigns
  FOR ALL USING (get_my_role() = 'director') WITH CHECK (get_my_role() = 'director');

CREATE POLICY "Marketing manages own branch campaigns" ON public.campaigns
  FOR ALL
  USING (get_my_role() = 'marketing' AND branch_id = get_my_branch())
  WITH CHECK (get_my_role() = 'marketing' AND branch_id = get_my_branch());
```

### Notifications
```sql
CREATE POLICY "Users view own notifications" ON public.user_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users view role notifications" ON public.user_notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = user_notifications.target_role)
  );
```

---

## Route Structure

```
app/
  (auth)/
    login/
    complete-profile/
  (dashboard)/
    layout.tsx              ← sidebar + role guard + notifications bell
    director/
      overview/             ← cross-branch KPI + charts
      branches/             ← CRUD branches
      reports/              ← approve/reject monthly reports
      staff/                ← manage all staff
    finance/
      transactions/         ← list + add + confirm
      reports/              ← generate + submit monthly report
    hr/
      staff/                ← staff list + invite
      attendance/           ← calendar + monthly summary
    marketing/
      campaigns/            ← CRUD campaigns
    patients/               ← all roles, branch-scoped by RLS
      [id]/
        visits/
    notifications/
    settings/
```

---

## Role Guard

```typescript
// lib/auth.ts
import { redirect } from 'next/navigation'
import { SupabaseClient } from '@supabase/supabase-js'

type UserRole = 'director' | 'finance' | 'hr' | 'marketing'

export async function requireRole(supabase: SupabaseClient, allowed: UserRole[]) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('id', user.id)
    .single()

  if (!profile || !allowed.includes(profile.role as UserRole)) {
    redirect('/unauthorized')
  }
  return profile
}
```

---

## Supabase Client

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  )
}
```

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # server-only, never expose to client
```

---

## Key Design Decisions

- **Branch isolation via RLS**: `get_my_branch()` scopes all non-director queries at the database level — no application-level filtering needed.
- **Director = NULL branch_id**: the absence of a branch is the director signal; director policies check role only.
- **Monthly report as the reporting bridge**: finance submits `branch_financial_reports` per month; director approves. Director can also query raw `transactions` directly for ad-hoc analysis.
- **Flat four-role hierarchy**: no `administrator` sub-role; director is the ceiling.
- **Tailwind v4**: uses `@import 'tailwindcss'` not `@tailwind` directives; CSS variables are used directly via `var(--primary)` not HSL tuples.
