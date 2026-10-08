-- =====================================================================
-- ASPIRE CR CONNECT — 0006: Optional header/footer banner images
-- Reports can now use an uploaded image (JPG/PNG) as the header and/or
-- footer instead of plain text — the choice is per-slot: if an image URL
-- is set for a slot, it's used; otherwise the existing text is used.
-- This is available both globally (system_settings) and per-class/section
-- (report_branding), with the per-class/section value taking priority
-- over the global one when both are set (same fallback pattern already
-- used for logo_url).
-- =====================================================================

-- ---------- system_settings: global header/footer text + images ----------
alter table system_settings add column if not exists header_text text;
alter table system_settings add column if not exists footer_text text;
alter table system_settings add column if not exists header_image_url text;
alter table system_settings add column if not exists footer_image_url text;

-- ---------- report_branding: per-class/section header/footer images ----------
alter table report_branding add column if not exists header_image_url text;
alter table report_branding add column if not exists footer_image_url text;

-- No new storage bucket needed: header/footer images reuse the existing
-- `report-logos` bucket and its policies (public read, Main Super Admin /
-- manage_classes admins can write), same as the existing per-class logo.
