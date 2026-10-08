# Aspire Group of Colleges, Taunsa Sharif
### College Website and Management Portal

The project has two parts: the **public college website**, and a **secure management portal** for the administration, the Principal, teachers and class representatives, and students. **CR Connect** is one module of the portal: attendance, concerns and reports for class representatives.

Developed By **Muhammad Zeeshan Haider**
*"Turning Ideas into Digital Solutions."*

---

## 1. What this is

A focused (not an ERP) system for:
- Class Representative management
- Daily attendance (Present/Absent)
- Student concerns
- PDF / JPG reporting
- Role-based administration with activity logs

**Stack:** React + TypeScript + Vite, Tailwind CSS, Supabase (Postgres + Auth + Storage). No separate backend server, no Docker, no Prisma.

---

## 2. Project structure

```
src/
  components/    Layout, UI primitives, CreditBox, ProtectedRoute
  pages/         MainSuperAdmin/ SubAdmin/ CR/ LoginPage
  services/      Supabase data-access functions per domain + reports/
  hooks/         useAuth (session + profile)
  types/         Shared TypeScript types matching the DB schema
supabase/
  migrations/    SQL schema, RLS policies
  functions/     create-user (Edge Function for creating CR / Sub Admin accounts)
```

---

## 3. Create your Supabase project

1. Go to https://supabase.com/dashboard and click **New Project**.
2. Choose an organization, name it `aspire-cr-connect`, set a database password, pick a region close to Pakistan (e.g. Singapore), and create the project.
3. Wait for provisioning (1–2 minutes).

### Get your API keys
Go to **Project Settings → API**:
- Copy the **Project URL** → this is `VITE_SUPABASE_URL`
- Copy the **anon public key** → this is `VITE_SUPABASE_ANON_KEY`

---

## 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Never commit `.env` or paste the **service role** key into frontend code.

---

## 5. Run the database migrations

Run these **in order** — `0001` first, through `0005`.

**Option A — SQL Editor (simplest):**
1. Open **Supabase Dashboard → SQL Editor**.
2. Paste the full contents of `supabase/migrations/0001_init.sql`, click **Run**.
3. Paste the full contents of `supabase/migrations/0002_profiles_branding_storage.sql`, click **Run**.
4. Paste the full contents of `supabase/migrations/0003_principal_role.sql`, click **Run**.
5. Paste the full contents of `supabase/migrations/0004_principal_rls.sql`, click **Run**.
6. Paste the full contents of `supabase/migrations/0005_announcements.sql`, click **Run**.

`0003` and `0004` must be run as two separate statements/migrations — Postgres won't let a new enum value (`PRINCIPAL`) be used in the same transaction that creates it.

Continue the same way through the rest of the `migrations/` folder, in filename order (`0006`, `0007`, `0008`, `0009`, `0010`, `0011`, `0012`, …) — each adds a feature on top of the previous ones. `0009_smart_csv_import.sql` adds the Smart CSV Import engine (see below). `0010_concern_status_enum.sql` + `0011_concerns_upgrade.sql` add the Universal Concern & Complaint System (see below) — **run these two as separate steps**, same reason as `0003`/`0004`: `0011` uses enum values that `0010` adds, and Postgres won't allow a new enum value to be used in the same transaction that adds it. `0012_simplify_attendance.sql` collapses lecture-wise attendance into one daily Present/Absent session per section (see below).

**Option B — Supabase CLI:**
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

This creates all tables (`profiles`, `classes`, `sections`, `students`, `cr_assignments`, `attendance_sessions`, `attendance_records`, `student_concerns`, `admin_permissions`, `admin_activity_logs`, `system_settings`, `report_branding`, `announcements`, `announcement_reads`), relationships, indexes, RLS policies, and the `avatars` / `report-logos` Storage buckets with their own policies.

---

## 6. Deploy the `create-user` Edge Function

Creating Sub Super Admin, Principal, and CR accounts requires Supabase's admin API, which needs the **service role key** — this can only run server-side, so it's implemented as an Edge Function.

```bash
supabase functions deploy create-user
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

(Get the service role key from **Project Settings → API → service_role** — keep it secret, never put it in the frontend or `.env` used by Vite.)

If you already deployed this function before the Principal role was added, redeploy it (`supabase functions deploy create-user`) — the previous version rejects `role: 'PRINCIPAL'`.

---

## 7. Create the first Main Super Admin

The very first admin account must be created manually (there's no one yet to click "Create Admin"):

1. **Supabase Dashboard → Authentication → Users → Add User.**
   - Email: e.g. `zeeshan@aspire.edu.pk`
   - Password: set a strong temporary password
   - Confirm the user immediately (check "Auto Confirm User").
2. Copy the new user's **UID**.
3. Go to **SQL Editor** and run:

```sql
insert into profiles (id, full_name, email, phone, role, is_active)
values (
  'PASTE-THE-USER-UID-HERE',
  'Muhammad Zeeshan Haider',
  'zeeshan@aspire.edu.pk',
  '03000000000',
  'MAIN_SUPER_ADMIN',
  true
);
```

You can now log in with this account and it will land on `/admin`. From there, use **Sub Super Admins** and **Class Representatives** pages to create every other account — the app never lets a Sub Super Admin or CR promote themselves.

---

## 8. Run the frontend locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

> **Forgot password to work:** In **Supabase Dashboard → Authentication → URL Configuration**, set your **Site URL** (and add it under **Redirect URLs**) to wherever you deploy the app, e.g. `https://your-app.vercel.app`. Locally this is `http://localhost:5173`. Without this, password-reset emails will link back to the wrong place.

---

## 9. Build & deploy the frontend

```bash
npm run build
```

This outputs static files to `dist/`, deployable to:

- **Vercel:** `vercel deploy` (framework preset: Vite) — set the two `VITE_` env vars in Project Settings → Environment Variables.
- **Netlify:** drag-and-drop `dist/`, or connect the repo (build command `npm run build`, publish directory `dist`). Set the env vars in Site Settings.

No server component is needed — Supabase is the entire backend.

---

## 10. How the role system works (important)

- Roles (`MAIN_SUPER_ADMIN`, `PRINCIPAL`, `SUB_SUPER_ADMIN`, `CR`) live in the `profiles` table, **never** chosen on the login screen.
- After Supabase Auth sign-in, the app reads the user's `role` from the database and redirects accordingly.
- Row Level Security enforces the same rules at the database layer — even if someone tampered with the frontend, Postgres itself blocks unauthorized reads/writes.
- A CR's data access is restricted to their **currently assigned** section(s) via `cr_assignments` + RLS policies (`my_assigned_sections()`) — a CR can now hold more than one active assignment and switches between them from a section picker in the app.
- Sub Super Admins can never edit, deactivate, or promote themselves to `MAIN_SUPER_ADMIN` — enforced both in the `create-user` Edge Function and in the `profiles_update_admin` RLS policy.
- **Principal** is a read-only oversight role: full visibility into students, attendance, concerns, CR assignments, reports and statistics (`is_principal()` in RLS), but zero write access anywhere and zero visibility into `admin_activity_logs`. Only a Main Super Admin can create Principal accounts (`/admin/principals`).
- **Activity Logs** (`/admin/logs`) are visible to the **Main Super Admin only** — Sub Super Admins and Principals cannot see them, even their own actions.
- **Reports & Statistics** follow the same hierarchy as management: Main Super Admin, Principal, and Sub Super Admin can all generate reports and view the Statistics dashboard (each already scoped by RLS to what their role can see); a CR's Reports page is scoped to their own assigned section(s) only.
- **Announcements** (`/announcements`) let each role broadcast down the hierarchy: Main Super Admin → anyone; Principal → Sub Super Admins and CRs; Sub Super Admin → CRs; a CR can only receive, never post. This is enforced both in the compose UI (`allowedAudienceFor()`) and at the database layer (`can_announce_to()`), so it can't be bypassed from the client.
- **Concerns** (`/concerns`) — see §13 — are role-aware rather than tied to one role: everyone can raise one (Sub Super Admin needs the `raise_concerns` permission); visibility and management follow `view_concerns`/`manage_concerns` (Sub Super Admin) or fixed role behavior (Principal: raise + view-all, no manage; CR: own + assigned + section/class-scoped).

---

## 11. What's implemented vs. what to extend

**Fully working:**
- Supabase Auth login with DB-driven role redirect, redesigned split-panel sign-in screen with show/hide password and a self-service "Forgot password" flow (Supabase's built-in reset email)
- Automatic sign-out after 15 minutes of inactivity (change the `IDLE_TIMEOUT_MS` constant in `src/hooks/useIdleLogout.ts` to adjust)
- Self-service Profile page (`/profile`, all roles) — upload a profile picture (stored in the `avatars` Supabase Storage bucket), edit your own full name & mobile number, and change your password
- CR and Sub Super Admin creation now requires email **and** mobile number; the full name entered at creation is exactly what shows as that person's profile name everywhere in the app
- Per-class or per-section report branding (`/admin/report-branding`) — set a custom header line, footer line, and logo for a specific class or section's PDF/JPG reports, overriding the global college branding in System Settings
- Main Super Admin: dashboard, students CRUD, **Smart CSV Import** (auto-detects and creates missing classes/sections, matches existing students by roll number to classify New/Existing/Update/Movement/Duplicate/Conflict, atomic server-side commit, downloadable import report) & CSV export, classes/sections, CR account creation & assignment, Sub Super Admin creation & permission management, activity logs, system settings, PDF/JPG report generation, full oversight of the **Universal Concern & Complaint System**
- Sub Super Admin: scoped dashboard (extend page guards using `admin_permissions` as needed for your exact policy)
- CR: dashboard, daily attendance (Present/Absent, one session per section per day, with duplicate-day prevention), attendance history, my students with attendance %, disciplinary student concerns (quick-select + custom, at `/cr/concerns`) plus the general **Concerns** hub (`/concerns`) for raising/tracking any institutional concern, individual & class attendance reports (PDF/JPG, using any class/section branding override)
- Full SQL schema with RLS for every table, including self-service profile updates that cannot be used to change your own role, active status, or email
- Admin activity logging wired into every create/edit/delete action

**Recommended next steps for production hardening:**
- Add pagination to Activity Logs and Concerns lists for large datasets
- Add stricter UI gating for Sub Super Admin pages based on each individual permission flag (the RLS already enforces this at the data layer; the UI can hide buttons the user isn't permitted to use)
- Add automated tests per the test plan in the original specification (auth, CRUD, CSV edge cases, CR restrictions, attendance duplicate prevention, PDF/JPG generation)
- **Pre-existing gap, not introduced by this change:** `supabase/functions/create-user/index.ts`'s `sanitizePermissions()` only recognizes an older set of field names (`can_manage_students`, `can_manage_complaints`, …) that don't match the real `admin_permissions` columns (`manage_students`, `view_concerns`, `raise_concerns`, …), so permissions passed at Sub Super Admin *creation* time don't reliably land — worth reconciling that function with the current schema. The Manage Permissions modal on `/admin/sub-admins` (`updateAdminPermissions`) talks to the real columns directly and is unaffected.

---

## 12. Smart CSV Import (`/admin/students`)

The CSV importer no longer rejects a row just because its class or section doesn't exist yet.

1. **Download Template** gives the expected columns, but the header aliasing is forgiving — "Roll No", "Full Name", "Grade", "Group", "Mobile", etc. all map to the right field, so a school's existing export usually works unmodified.
2. Upload a CSV → the importer parses it, fetches only the students whose roll numbers appear in the file (batched, not one query per row), and classifies every row: **New**, **Existing**, **Update** (existing student, changed name/phone), **Movement** (roll number found under a different class/section), **Duplicate** (same roll number twice in the file), **Conflict** (roll number ambiguous across multiple existing students), or **Error** (missing required field).
3. The review screen shows which classes/sections are new vs. already there, lets you opt in to updating changed students, and requires you to explicitly confirm each possible movement before it's applied — nothing about an existing student changes silently.
4. Confirming the import calls the `apply_student_import` Postgres function (`supabase/migrations/0009_smart_csv_import.sql`) once, as a single transaction: it creates any missing classes/sections (case/whitespace-insensitive, so "1st Year" and " 1st year " never become two rows), inserts/updates/moves the relevant students, and writes the activity log entry — all together, or none of it if anything fails partway through.
5. The completion screen offers a downloadable plain-text import report and a way to jump back to the student list.

This requires the `import_students` permission (Main Super Admin always has it; grant it to a Sub Super Admin from `/admin/sub-admins`).

---

## 13. Universal Concern & Complaint System (`/concerns`)

Concerns are no longer a CR-only, disciplinary-only feature. `/concerns` is a shared hub (Main Super Admin, Principal, Sub Super Admin, and CR all get it in their nav) for raising and tracking institutional concerns — academic issues, infrastructure, safety, teacher/faculty concerns, and so on — alongside the original CR "report a student's misbehavior" workflow, which still lives at `/cr/concerns` ("Report Student Concern") and works exactly as before.

**Important architectural note:** this app has no student login — only Main Super Admin, Principal, Sub Super Admin and CR accounts exist (see §10). So "Student" as a concern *submitter* isn't implemented as a real authenticated role, since there's no student session to attach it to. What the system supports instead: any authenticated CR/Admin/Principal can raise a concern **on behalf of** a student by picking that student from the "Related Student" field — which covers "student welfare concern" type cases without inventing a parallel student-auth system as a side effect of this feature. If real student self-service accounts are ever added, this is the natural point to let them raise their own.

**How it works:**

- **Who can raise one:** Main Super Admin, Principal, and CR always can. Sub Super Admin can if granted the new `raise_concerns` permission (`/admin/sub-admins` → Manage Permissions; on by default).
- **Category / Subject / Description / Priority / Scope:** every concern gets a configurable category (Settings → same list a Main Super Admin can already extend), a subject, an optional description, a priority (Low/Medium/High/Urgent — CR submissions are capped at High; only admins/Principal can set Urgent), and a scope (Personal, Section, Class, Institution) that governs who else can see it besides the submitter and whoever it's assigned to.
- **Lifecycle:** Submitted → Acknowledged → Under Review → In Progress → Resolved → Closed, with Reopened available from Resolved/Closed. Status, priority, and assignment changes all go through one atomic, audited server function (`update_concern`), so the history trail can never drift out of sync with the actual record.
- **Comments:** a chronological thread per concern. Concern managers (and whoever it's assigned to) can also add **internal notes** that are never shown to the person who raised it.
- **Attachments:** PNG/JPEG/WebP/PDF up to 10MB, stored in a private Supabase Storage bucket (`concern-attachments`) — access is governed by the same visibility rule as the concern itself, never by the file being merely logged in, i.e. no attachment is reachable by anyone who couldn't already see the concern it belongs to.
- **Notifications:** in-app only (no email/SMS/push — that would need an external provider this project doesn't wire up). A bell icon on `/concerns` shows unread updates: new concerns (to Main Super Admin + any Sub Super Admin with `manage_concerns`), assignment, replies, resolution, and reopening.
- **Visibility:** enforced in Postgres RLS, not just the UI. Main Super Admin sees everything; Principal sees everything read/raise-only (consistent with its existing read-only-oversight role elsewhere — Principal can raise and view, not assign/resolve/close); Sub Super Admin sees everything only if granted `view_concerns`, and can manage (assign/resolve/close) only if granted `manage_concerns`; a CR always sees what they raised or were assigned, plus Section/Class-scoped concerns tied to a section they're assigned to. Personal/Institution-scoped concerns are never exposed by section/class membership alone.
- **Existing data:** every pre-existing CR-submitted concern keeps working — the underlying table was extended (nullable student/class/section, new priority/scope/assignment/timestamps columns), not replaced, and existing rows were backfilled (`created_by_role`, `scope='SECTION'`) rather than left inconsistent.

Migrations: `0010_concern_status_enum.sql`, `0011_concerns_upgrade.sql` (see §5 above for why they must run as two separate steps).

---

## 14. Attendance is Present/Absent only (no more "lecture-wise")

Attendance used to be taken per lecture (Entry, Lecture 1, Lecture 2, …), each with an optional subject/teacher and four possible marks (Present/Absent/Late/Leave). It's now simpler: a CR takes **one attendance session per section per day**, marking each student **Present or Absent** — that's it. The lecture picker, subject/teacher fields, and Late/Leave options are gone from `/cr/take-attendance`, attendance history, admin attendance records, statistics, and both PDF/JPG report builders.

- **Duplicate prevention** now works per day instead of per lecture: once a section's attendance is taken for a date, `/cr/take-attendance` shows "Attendance for today has already been recorded" and won't let it be entered twice.
- **Existing historical data is untouched.** Old multi-lecture-per-day sessions (and any old Late/Leave records) keep displaying exactly as they were recorded — the migration (`0012_simplify_attendance.sql`) only makes `lecture_number` nullable and changes the *uniqueness rule* for new sessions; it doesn't rewrite or delete a single existing row. History/report views that tally session statuses (e.g. the CR attendance-history detail panel) tally whatever statuses actually appear, so an old session with a Late/Leave mark still displays correctly — new sessions just never produce one.
- The `attendance_status` enum in Postgres still technically has `LATE`/`LEAVE` values (Postgres makes dropping enum values impractical, and there's no need to — the app simply stops writing them). This is intentional, not an oversight.

Migration: `0012_simplify_attendance.sql`.

---

## 15. Reports: Daily vs. Complete

Both report screens used to only ever produce an all-time report. They now let you choose the period:

- **CR Reports (`/cr/reports`):** a "Report Period" toggle — **Complete (All-Time)** (unchanged, every day ever recorded) or **Daily** (a single date, defaulting to today). In Daily mode, the Individual and Class reports show exactly what was recorded for that one day (Present/Absent per student — "Not Marked" if attendance wasn't taken, or if a student wasn't part of that day's session), not aggregated totals. Attempting a Daily report for a date attendance hasn't been taken for shows a clear message instead of an empty/misleading report.
- **Admin Reports (`/admin/reports`):** the existing From/To range gained quick-select buttons — **Today (Daily Report)**, **Last 7 Days**, **Last 30 Days**, and **Clear (Complete Report)** — so a daily report is one click instead of typing the same date into both fields.

No schema or migration changes were needed for this — it's a UI/query-filtering change on top of the existing `date` column.

---

## 16. Support

This project was scaffolded to match the full specification: focused scope (no fee/exam/library/hostel/transport modules), Supabase-only backend, daily attendance, student concerns, CSV import/export, PDF/JPG reporting, and a full admin hierarchy with accountability logs.

**Aspire Group of Colleges, Taunsa Sharif — College Website and Management Portal** — Developed By **Muhammad Zeeshan Haider**
*"Turning Ideas into Digital Solutions."*
