-- =====================================================================
-- ASPIRE CR CONNECT — Universal Concern & Complaint System (phase 1/2)
--
-- Adds the extra lifecycle stages to the existing concern_status enum.
-- This MUST run as its own migration/transaction, separate from
-- 0011_concerns_upgrade.sql, which references these new values —
-- Postgres will not let a new enum value be used in the same
-- transaction that adds it (see 0003/0004 for the same rule applied
-- to the PRINCIPAL role).
-- =====================================================================

alter type concern_status add value if not exists 'ACKNOWLEDGED' after 'SUBMITTED';
alter type concern_status add value if not exists 'IN_PROGRESS' after 'UNDER_REVIEW';
alter type concern_status add value if not exists 'REOPENED' after 'CLOSED';
