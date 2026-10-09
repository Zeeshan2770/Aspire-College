# CR Connect module — Student Portal Implementation Notes

Additive only, same rule as before: no existing table dropped/renamed, no existing column removed, no existing route, RPC, or component deleted. Every RLS policy and RPC that already existed for MAIN_SUPER_ADMIN/PRINCIPAL/SUB_SUPER_ADMIN/CR keeps behaving exactly as before — verified by copying their conditions verbatim into the rewritten functions rather than restating them from memory.

## 1. What was inspected before writing anything

- **Role enum**: `app_role` (MAIN_SUPER_ADMIN, SUB_SUPER_ADMIN, CR, and PRINCIPAL added in its own migration `0003`). STUDENT follows the identical pattern (`0014_student_role.sql`), for the identical reason — Postgres won't let a new enum value be used in the same transaction that adds it.
- **Auth pattern**: CR accounts (`0007`, `manage-cr-credentials` Edge Function) already use Supabase Auth with a *synthetic* email (`cr{section}{class}@aspiretaunsa.com`) and a plaintext-in-a-locked-down-table credentials vault (`cr_credentials`, MAIN_SUPER_ADMIN-only RLS) purely so a forgotten password can be looked up again. The Student Portal reuses this exact pattern — synthetic `@students.aspiretaunsa.com` email, `student_credentials` vault, same RLS lockdown — rather than inventing a new auth mechanism.
- **Concern/query system**: `student_concerns` (`0010`/`0011`) already has category, subject/description, priority, scope, status (including ACKNOWLEDGED, UNDER_REVIEW, REOPENED — the spec's workflow was already present), assignment, `concern_history`, `concern_comments` (with `is_internal` hidden from non-managers), and `concern_notifications`. Student queries are `student_concerns` rows with `created_by_role = 'STUDENT'` — no new table.
- **Attendance**: `attendance_sessions`/`attendance_records`, already simplified (`0012`) to one session per section per day. The Student Portal reads these directly (read-only) rather than keeping any separate copy.
- **CSV import**: `apply_student_import` (`0009`) is an atomic RPC; it never wrote `father_name` even though the spec (and the earlier Quick Reports upgrade) assumed it would. Fixed here (`0016`) rather than left broken.

## 2. Files changed / added

| File | What |
|---|---|
| `supabase/migrations/0014_student_role.sql` | Adds `STUDENT` to `app_role`. |
| `supabase/migrations/0015_student_portal.sql` | Student identity columns, `student_credentials` vault, `next_student_uid()` generator, RLS extensions for student self-access, rewritten `create_concern`/`update_concern` RPCs. |
| `supabase/migrations/0016_csv_father_name.sql` | Adds `father_name` (and a coalesce-on-update so a blank CSV cell never erases an existing value) to the CSV import RPC. |
| `supabase/functions/manage-student-credentials/index.ts` | New Edge Function: create / reset_password / regenerate / disable / enable / delete. Main Super Admin only, service-role key never leaves the function. |
| `src/services/studentAccounts.ts`, `studentAuth.ts`, `studentPortal.ts` | New frontend service layer. |
| `src/types/index.ts` | `STUDENT` role, new `Student`/`Profile` fields, `STUDENT_QUERY_CATEGORIES`. |
| `src/pages/LoginPage.tsx` | Staff/Student toggle; student identifier is translated to the synthetic email before `signIn`. |
| `src/components/layout/StudentLayout.tsx` | New, fully separate mobile-first nav (bottom tab bar on phones, slim top tabs on desktop) — never shares the admin `DashboardLayout`. |
| `src/pages/Student/{Dashboard,Attendance,RaiseQuery,MyQueries,Profile}.tsx` | The Student Portal itself. |
| `src/pages/MainSuperAdmin/StudentAccounts.tsx` | Admin account management, mirrors `CrAccounts.tsx`. |
| `src/services/csv.ts`, `src/services/smartImport.ts`, `src/components/students/SmartImportWizard.tsx` | Father Name column support + a "Create Student Login" checkbox that runs as a best-effort step after the import transaction commits. |
| `src/App.tsx`, `src/components/layout/DashboardLayout.tsx` | New routes and one new admin nav entry. |

## 3. Security model — how "a student can never see another student's data" is actually enforced

This is enforced at the database layer, not the UI:

- `students`, `attendance_sessions`, `attendance_records` SELECT policies were each extended with **one additional OR clause** granting access only where the row belongs to `auth.uid()`'s own linked student record (`user_id = auth.uid()` / `student_id = my_student_id()` / `section_id = my_student_section_id()`). Nothing else about those policies changed — CR and admin access is copied verbatim.
- `create_concern` **ignores** any `student_id`/`class_id`/`section_id`/`scope` a STUDENT caller sends and derives all four from `select * from students where user_id = auth.uid()` inside the function itself. A student cannot raise a query "as" another student by editing a request, because the server never trusts that field from them in the first place.
- `update_concern`'s reopen carve-out only fires when `reported_by = auth.uid()` on that specific row — a student cannot reopen (or otherwise touch) anyone else's concern.
- Internal comments/notes: unchanged `concern_comments` RLS already hides `is_internal = true` rows from anyone who isn't a manager or the assignee. Students were never made managers, so this required no change at all.
- `student_credentials` (temp passwords) is locked to `is_main_super_admin()` only — a student's own client can never read their own temp password back out of the database; they only ever see it once, from the Edge Function's direct response, at creation/reset time.

## 4. Notable design decisions

- **Notifications**: Main Super Admin and permitted Sub Super Admins already get notified via the existing `concern_manager_profile_ids()`. Principal did **not** get notified for any concern before this change. Rather than adding Principal to that function globally (which would change notification behavior for every CR/admin concern too), `create_concern` unions in active Principals **only when `created_by_role = 'STUDENT'`** — exactly matching the spec's "Main Super Admin, Sub Super Admins, and the Principal" list for student queries specifically, with zero effect on any other concern type.
- **CRs are not given query access.** No policy or function above grants CR any visibility into `student_concerns` rows they didn't already have access to. Per spec §10, this was a deliberate omission, not an oversight.
- **Subject-wise attendance** only appears when the data actually supports it. Since `0012_simplify_attendance.sql` already stopped recording a `subject` per session, most attendance going forward has no subject — the Student Portal reports overall attendance either way, and only renders the subject-wise table when at least one session on record actually has a subject. Building a subject-wise table would otherwise mean inventing subjects that were never recorded.
- **Username, not email.** Supabase Auth needs an email-shaped identifier, so — exactly like the existing CR accounts — a synthetic `stu-26-0001280@students.aspiretaunsa.com` address is what's actually stored. The person only ever sees/types `STU-26-0001280`; `resolveStudentLoginEmail()` does the translation in one place.
- **CSV "Create Student Login" runs after the import commits, not inside it.** The import RPC is atomic on purpose (all rows or none); login creation calls an external Edge Function per student and can partially fail for reasons unrelated to the import (network, an already-existing account, a name collision) — a failed login creation should never roll back a successful student import. It's reported back as "N created / N already had an account / N could not be matched," not silently swallowed.
- **Temp-password enforcement** uses a new `profiles.must_change_password` boolean (self-updatable, per the existing `profiles_update_self` policy from `0002`) rather than trying to read it out of the locked-down `student_credentials` vault client-side, which would have required either weakening that table's RLS or a second round-trip through an Edge Function on every login.

## 5. Before you deploy

1. Run `0014`, `0015`, `0016` **in that numeric order** (they must run before `0013`'s zip if you're deploying both upgrades — `0013` was already delivered in the prior upgrade and should already be applied first).
2. Deploy the `manage-student-credentials` Edge Function (`supabase functions deploy manage-student-credentials`), same environment variables as `manage-cr-credentials`.
3. `npm install && npm run build` — again, I have no network access in this environment and could not run this myself.
4. Existing students will show under "Without Account" in Student Accounts until you create logins for them (individually, or via CSV re-import with "Create Student Login" checked).

## 6. Testing checklist (spec §23, mapped to what to actually click)

1. **Student can log in** — Login page → Student Login tab → enter the Student ID (or full username) + temp password → lands on `/student`.
2. **Student sees only their own attendance** — `/student/attendance` shows only rows where `student_id` = their own; confirm via a second student's login that the numbers differ.
3. **Student cannot modify attendance** — no write control exists anywhere in the Student Portal UI; additionally, confirm no `attendance_records`/`attendance_sessions` INSERT/UPDATE policy exists for STUDENT (there isn't one — only SELECT was added).
4. **Cannot access another student's attendance by changing IDs** — this app doesn't route attendance by ID in the URL at all (it's always "my own"), and even a direct REST call to `attendance_records?student_id=eq.<other-id>` is blocked by RLS regardless of the frontend.
5. **Student can submit a query** — `/student/raise-query`, pick a category, submit; appears immediately under `/student/queries`.
6–8. **Main Super Admin / authorized Sub Super Admins / Principal receive notification** — check `concern_notifications` for one row per recipient after a student submits a query; Principal should receive one specifically because `created_by_role = 'STUDENT'`.
9. **Student sees their query status** — `/student/queries` list badge.
10. **Student sees replies** — open a query, non-internal comments show under Replies.
11. **Student cannot see internal notes** — have an admin add an internal note (`is_internal = true`) via the existing admin concern UI, confirm it never appears in the student's Replies list.
12. **Student cannot access administrative dashboard** — `ProtectedRoute` on every `/admin`, `/cr`, `/principal`, `/sub-admin` route rejects role `STUDENT`, redirecting to `/`.
13. **CR permissions remain unchanged** — no CR-facing policy or RPC branch was altered; spot-check `/cr` attendance and concerns still work as before.
14. **Existing attendance continues working** — manual + OCR-scan attendance flows untouched.
15. **Existing CR concern system continues working** — `/cr/concerns`, `/concerns` unaffected; `create_concern`'s CR branch is a verbatim copy of the pre-existing condition.
16. **Existing CSV import continues working** — import a CSV without a Father Name column at all; should still work exactly as before (the field is optional).
17. **Duplicate student accounts are prevented** — try creating a second account for a student who already has `user_id` set; both the "Create Account" button (hidden once they have one) and the Edge Function's explicit check block it.
18. **Temporary passwords are not stored as plaintext** in an unprotected place — `student_credentials` has RLS restricting it to `is_main_super_admin()` only; Supabase Auth itself stores the real, usable password hash, never plaintext.
19. **Disabled accounts cannot log in** — disable a student account from Student Accounts, confirm the next login attempt is rejected (`LoginPage` checks `profile.is_active` and signs the session back out if false).
20. **RLS prevents cross-student access** — as in #4, verified at the database policy level, not just hidden in the UI.

## 7. Known follow-ups (flagged, not silently skipped)

- The CSV wizard's row-review table doesn't show a Father Name column yet — the data is imported correctly, just not previewed in that table.
- `session_label` ("Session" on the student profile) has no admin UI to set it yet — it's a plain nullable column on `students`; add an input to the Students admin form when you're ready to start using it.
- Password-reset-by-email (spec §20) wasn't built for students, matching the spec's own guidance that email-based recovery is often impractical for student accounts — resets are Main-Super-Admin-driven via Student Accounts, exactly as designed there.
