-- =====================================================================
-- ASPIRE CR CONNECT — Student role
--
-- Adds the STUDENT value to the existing role enum. Kept in its own
-- migration file for the same reason 0003_principal_role.sql is:
-- Postgres will not allow a new enum value to be used in the same
-- transaction that adds it. Everything that depends on 'STUDENT'
-- (tables, RLS, RPC changes) lives in 0015_student_portal.sql.
-- =====================================================================

alter type app_role add value if not exists 'STUDENT';
