-- =====================================================================
-- 0013: Quick Reports & Messages + Smart Attendance Scanner support
--
-- Purely additive — no existing table is dropped or renamed, no existing
-- column is removed, and every new column is nullable or has a safe
-- default so current rows and current app code keep working unchanged.
-- =====================================================================

-- ---------- students: father_name ----------
-- Needed so the Quick Report message can be generated without the CR
-- typing information that already exists in the database.
alter table students add column if not exists father_name text;

-- ---------- system_settings: Communication (coordinator) settings ----------
alter table system_settings add column if not exists coordinator_name text;
alter table system_settings add column if not exists coordinator_whatsapp text;
alter table system_settings add column if not exists coordinator_secondary_name text;
alter table system_settings add column if not exists coordinator_secondary_whatsapp text;
alter table system_settings add column if not exists default_report_signature text not null default 'Aspire CR Connect';

-- ---------- system_settings: Developer Credit ----------
alter table system_settings add column if not exists credit_enabled boolean not null default true;
alter table system_settings add column if not exists credit_text text not null default 'Muhammad Zeeshan Haider';
alter table system_settings add column if not exists credit_logo_url text;

-- ---------- system_settings: Attendance settings ----------
-- default_attendance_behavior: 'ALL_PRESENT' (current default) or 'ALL_UNMARKED'
alter table system_settings add column if not exists default_attendance_behavior text not null default 'ALL_PRESENT';
alter table system_settings add column if not exists allow_ocr_scanning boolean not null default true;
alter table system_settings add column if not exists ocr_review_required boolean not null default true;

alter table system_settings
  drop constraint if exists system_settings_default_attendance_behavior_check;
alter table system_settings
  add constraint system_settings_default_attendance_behavior_check
  check (default_attendance_behavior in ('ALL_PRESENT', 'ALL_UNMARKED'));

-- ---------- attendance_sessions: optional provenance ----------
-- Lets admins tell a scanned session apart from a manually-taken one in
-- reports, without touching the existing manual flow at all (defaults to
-- the same behavior as before this migration).
alter table attendance_sessions add column if not exists source text not null default 'MANUAL';
alter table attendance_sessions
  drop constraint if exists attendance_sessions_source_check;
alter table attendance_sessions
  add constraint attendance_sessions_source_check
  check (source in ('MANUAL', 'OCR_SCAN'));

-- Quick Reports reuses the existing student_concerns table (concern_type +
-- short_description + additional_notes already capture everything a
-- report needs) so no new table is required. concern_categories in
-- system_settings already drives the selectable category list; the
-- specific labels requested for Quick Reports are merged in below so
-- existing categories are kept and nothing already in use is removed.
update system_settings
set concern_categories = (
  select jsonb_agg(distinct value)
  from jsonb_array_elements(
    concern_categories || '[
      "Mobile Phone Use","Bullying","Disturbing the Class","Misbehavior",
      "Disrespectful Behavior","Late / Irregular Attendance",
      "Leaving Class Without Permission","Academic Concern",
      "Repeated Absence","Other"
    ]'::jsonb
  ) as value
)
where id = 1;
