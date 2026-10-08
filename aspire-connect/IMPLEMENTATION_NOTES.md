# CR Connect module — Upgrade Implementation Notes

Everything below is additive to your existing codebase — no table was dropped/renamed, no existing column removed, no existing route or component deleted. Where a feature you asked for already existed in some form (Concerns/complaints, attendance), I extended it instead of duplicating it.

## 1. Files changed

| File | Change |
|---|---|
| `supabase/migrations/0013_quick_reports_and_settings.sql` | **New.** Adds `father_name` to `students`; coordinator/communication, developer-credit, and attendance-settings columns to `system_settings`; a `source` column to `attendance_sessions`. |
| `src/types/index.ts` | Added `father_name` to `Student`; new `SystemSettings` fields; `QUICK_REPORT_CATEGORIES`; `OcrAttendanceStatus` / `OcrReviewRow`; `source` on `AttendanceSession`. |
| `src/hooks/useSystemSettings.tsx` | **New.** Small cached hook so Settings, CreditBox, TakeAttendance, etc. share one `system_settings` fetch. |
| `src/components/CreditBox.tsx` | Now reads enable/disable + custom text + logo from settings; mini variant is collapsible. |
| `src/components/layout/DashboardLayout.tsx` | **Bug fix** — see §2. Added nav entries for Quick Reports and Scan Attendance. |
| `src/pages/MainSuperAdmin/Settings.tsx` | Reorganized into cards: General, Communication, Developer Credit, Attendance Settings (per your spec §5). |
| `src/pages/MainSuperAdmin/Students.tsx` | Added a Father Name field to the add/edit student form. |
| `src/services/quickReports.ts` | **New.** Message generation + WhatsApp/SMS link builders + copy/share helpers. |
| `src/pages/CR/QuickReport.tsx` | **New.** "Quick Reports & Messages" page. Route: `/cr/quick-report`. |
| `src/pages/CR/TakeAttendance.tsx` | Added search, select-all present/absent, live summary, confirm-before-submit. |
| `src/services/attendanceOcr.ts` | **New.** Client-side OCR parsing (Tesseract.js) — roll number + P/A/Late detection with per-row confidence. |
| `src/pages/CR/ScanAttendance.tsx` | **New.** "Scan Attendance Sheet" page. Route: `/cr/attendance/scan`. |
| `src/services/attendance.ts` | `createAttendanceSession` now accepts an optional `source`. |
| `src/App.tsx` | Registered the two new CR routes. |
| `package.json` | Added `tesseract.js`. |

## 2. The credit-box overlap — root cause

The bug was real and specific: in `DashboardLayout.tsx`, `<CreditBox variant="mini" />` sat in an `absolute bottom-0` wrapper inside the `fixed` sidebar, while the nav list above it had no reserved space or its own scroll region. Main Super Admin has 16 nav items with **Settings as the very last one** — on shorter viewports that list could run under the absolutely-positioned credit box. Fixed by making the sidebar a flex column: nav scrolls in its own region (`flex-1 overflow-y-auto`), and the credit box sits below it in normal document flow (`shrink-0`), so it can never cover a nav link.

## 3. Design decisions worth knowing about

- **Quick Reports reuses `student_concerns`**, not a new table — your codebase already had a full concern/complaint system with RLS in place; Quick Reports is a purpose-built UI on top of it (auto-filled student card, category chips matching your requested list, generated editable message, WhatsApp/Copy/SMS/Share). Its "Recent Reports" history is the same underlying data as `/cr/concerns`.
- **No lecture/subject selector on attendance.** Migration `0012_simplify_attendance.sql` deliberately collapsed attendance to one session per section per day. Re-introducing a lecture selector for the scanner (as literally requested) would have fought that existing, working simplification — per your own rule #8 ("do not replace working functionality"), I kept the scanner on the same one-session-per-day model as manual attendance. If you do want per-lecture scanning, that's a deliberate follow-up decision, not an oversight.
- **OCR runs entirely in the browser** (Tesseract.js), not via an edge function or third-party API. This was a deliberate choice, not just a convenience: it means the photograph never leaves the device and is never written to Supabase Storage — it's read into memory, OCR'd, and discarded. That satisfies your privacy requirement by construction rather than by policy (nothing to accidentally leave lying around in a bucket). The tradeoff: in-browser OCR is slower and less accurate than a hosted OCR API on messy handwriting — the confidence-scored review screen exists specifically to catch that, and nothing is written to `attendance_records` until the CR taps **Confirm & Save**.
- **RLS: no changes needed.** New columns land on tables whose existing row-level policies already govern who can read/write which *rows* (Postgres RLS doesn't restrict by column). CR inserts for Quick Reports go through the same `concerns_insert` policy your existing Concerns page already uses; attendance reads/writes go through the same `students`/`attendance_sessions` policies TakeAttendance already used.

## 4. Before you deploy

1. Run the new migration: `supabase db push` (or apply `0013_quick_reports_and_settings.sql` via the SQL editor) **before** deploying the frontend, since the app now reads `father_name` and the new `system_settings` columns.
2. `npm install` (pulls in `tesseract.js`) and `npm run build` — I couldn't run this myself in this environment (no network egress here), so please do a real build/typecheck before shipping.
3. In **Settings → Communication**, set the coordinator's WhatsApp number — Quick Reports' WhatsApp/SMS buttons are disabled with a clear message until this is configured.
4. Existing students will have `father_name = NULL` until edited — Quick Report messages will show "N/A" for those until filled in via Students → Edit, or your CSV import (the smart CSV importer wasn't extended to map a father-name column in this pass — flagged below as a follow-up).

## 5. Testing checklist

**Quick Reports & Messages**
- [ ] CR selects a student → Name/Father Name/Roll/Class/Section auto-fill, nothing retyped.
- [ ] Each category chip changes the generated message; "Other" requires a description.
- [ ] Editing the message textarea directly stops it from being overwritten by further chip/detail changes.
- [ ] WhatsApp button opens `wa.me` with the message pre-filled and does **not** claim to have sent it.
- [ ] Copy Message copies to clipboard with a toast confirmation.
- [ ] Share uses the native share sheet where supported, falls back to Copy elsewhere.
- [ ] Report appears in "Recent Reports" and in `/cr/concerns` / admin Concerns view.
- [ ] With no coordinator number configured, WhatsApp/SMS show a clear inline warning instead of failing silently.

**Smart Attendance Scanner**
- [ ] Camera capture and file upload both work on mobile.
- [ ] No image is ever written to Supabase Storage (check the `attendance-photos`/any storage bucket — there should be none created by this flow).
- [ ] Review table shows Roll No. / Student / Detected Status / Confidence / Action for every roster student, including ones the scan missed.
- [ ] Low-confidence or unreadable marks show **Needs Review** and can be corrected via the Action dropdown.
- [ ] A roll number not on the roster appears under "Unknown Roll Number" and is excluded from save — no student is auto-created.
- [ ] Nothing is written until **Confirm & Save Attendance** is tapped; the confirmation modal shows the same Present/Absent/Not Marked counts as the review screen.
- [ ] Attempting to scan a date that already has a session shows "already recorded", same as manual attendance.
- [ ] Disabling "Allow OCR scanning" in Settings hides/blocks the scanner for CRs.

**Attendance UX**
- [ ] Search filters the list; Select All Present/Absent only affects the currently filtered rows.
- [ ] Summary bar (Present/Absent/Not Marked/%) updates live as marks change.
- [ ] Submitting with unmarked students prompts a confirmation; the final confirm modal shows class/section/date before writing.
- [ ] Manual attendance behavior (one session per section per day, duplicate blocked) is unchanged.

**Super Admin Credit Box**
- [ ] On a Main Super Admin account with the full 16-item nav, at 700–800px viewport height, Settings is fully visible and not covered by the credit box.
- [ ] Credit box collapses/expands in the sidebar without affecting nav item positions.
- [ ] Disabling "Show developer credit" in Settings hides it everywhere (sidebar, Settings page, login page); custom text/logo apply everywhere.

**Settings**
- [ ] Only Main Super Admin can reach `/admin/settings` (existing route guard — unchanged).
- [ ] Saving writes all four cards in one call and other open tabs/pages pick up the change (via the settings cache refresh) without a full reload.

**Regression**
- [ ] Existing Concerns flow (`/cr/concerns`, `/concerns`) still works unchanged.
- [ ] CSV import, report branding, statistics, activity logs — untouched, verify no regressions from shared type changes (`Student`, `SystemSettings`).
- [ ] `npm run build` passes with no TypeScript errors.

## 6. Known follow-ups (not done in this pass, flagged rather than silently skipped)

- The Smart CSV Import wizard (`0009_smart_csv_import.sql` / `SmartImportWizard.tsx`) wasn't extended to map a "Father Name" column — worth a small follow-up if you'll be bulk-importing that data.
- Students table listing doesn't yet show a Father Name column (it's in the add/edit form and used everywhere it matters — Quick Reports — but not in the admin list view).
- Confidence threshold and P/A mark vocabulary in `attendanceOcr.ts` are a reasonable starting point, not tuned against real sample sheets from your college — expect to adjust `CONFIDENCE_THRESHOLD` and the mark word lists after trying it on actual attendance sheets.
