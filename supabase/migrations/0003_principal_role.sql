-- =====================================================================
-- ASPIRE CR CONNECT — Principal role
-- A read-only oversight role, one level below Main Super Admin and one
-- level above Sub Super Admin: full visibility into students, attendance,
-- concerns, CR assignments, reports and statistics — but no management
-- (no create/edit/delete anywhere) and no access to admin activity logs.
--
-- NOTE: kept in its own migration file. Postgres will not allow a new
-- enum value to be used in the same transaction that adds it, so the RLS
-- work that depends on 'PRINCIPAL' lives in 0004.
-- =====================================================================

alter type app_role add value if not exists 'PRINCIPAL';
