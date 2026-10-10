# Migrations

`0001` to `0016` are the original CR Connect module migrations, unchanged.

`0017_college_site_and_admissions` (public website tables, admissions, faculty, news, events,
permission flags, and the admission/contact functions) is now in this folder. It was applied directly
to the Aspire Query project, and the file here was recovered from that project's migration history
and checked to be identical (MD5 match), so a fresh project can be rebuilt by running the files in order.

`0018` to `0021` add the principal fields and auto-publish date, restrict which database
functions anonymous visitors can call, and let class managers create subjects.

- 0023_section_subject_teachers.sql: teachers per section for each subject (run once in the Supabase SQL editor).

- `0024_gallery_and_multiple_images.sql` — adds the Gallery (albums) and extra photographs for news and events. Run once in the Supabase SQL Editor. Until it is run, the site works as before and the admin screens show a short note instead of the photo uploader.
- `0025_query_box.sql` — public "Ask Us" question box (identity options, attachments, tracking code) and its management inbox (Admissions → Questions). Run once in the Supabase SQL Editor (then run 0026). It also creates the private `query-attachments` storage bucket.
- `0026_query_box_hardening.sql` — run after 0025: upload limits, per-visitor rate limits for sending questions and checking tracking codes, and checks that attached files really exist.


## Order and status (Aspire Query project, checked 10 Oct 2026)

Run the files in numeric order on a new project: `0001` to `0026`.

| File | Live database |
|---|---|
| 0001 to 0021 | Applied and recorded in the migration history |
| 0022_customizable_dropdown_options | Applied (run in the SQL Editor, so it is not listed in the history) |
| 0023_section_subject_teachers | Applied (recorded as `section_subject_teachers` and `section_subject_teachers_many_per_subject`) |
| 0024_gallery_and_multiple_images | **Not applied yet.** Run it in the SQL Editor to switch on the Gallery and extra photos |
| 0025_query_box | Applied |
| 0026_query_box_hardening | Applied |

Notes for anyone comparing this folder with the Supabase migration history:
- Files `0001` to `0016` carry short names such as `0009_smart_csv_import`, while the history records slightly
  different names for three of them (`0009_smart_csv_import_indexes`, `0012_attendance_daily`, `0016_import_father_name`).
  The SQL is the same; only the labels differ.
- Scripts run through the SQL Editor are not written to the history table, so `supabase migration list` will not show
  `0022`, `0024`, `0025` or `0026` even where they are applied.
