-- =====================================================================
-- ASPIRE CR CONNECT — Simplify attendance to one daily Present/Absent mark
--
-- Attendance is no longer taken "per lecture". A CR now takes ONE
-- attendance session per section per day, marking each student simply
-- Present or Absent.
--
-- Historical data is preserved, not rewritten:
--   - attendance_status keeps its LATE/LEAVE enum values (Postgres can't
--     cheaply drop enum values, and there is no need to — any existing
--     LATE/LEAVE records just stay exactly as they were recorded). The
--     application simply never writes those values going forward.
--   - Existing multi-lecture-per-day sessions (lecture_number 0-8) are
--     untouched and keep showing correctly in history/reports.
--   - lecture_number becomes nullable; every NEW session is inserted with
--     it left null, and uniqueness for new-style sessions is enforced by
--     a partial index scoped to lecture_number is null, so it can never
--     conflict with (and never has to validate against) old multi-lecture
--     rows for the same section/date.
-- =====================================================================

alter table attendance_sessions alter column lecture_number drop not null;

alter table attendance_sessions
  drop constraint if exists attendance_sessions_section_id_date_lecture_number_key;

create unique index if not exists uniq_attendance_sessions_daily
  on attendance_sessions (section_id, date)
  where lecture_number is null;

comment on column attendance_sessions.lecture_number is 'Legacy per-lecture slot from before attendance was simplified to one daily Present/Absent mark. Always null on sessions created after this migration.';
