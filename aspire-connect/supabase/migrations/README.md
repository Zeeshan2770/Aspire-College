# Migrations

`0001` to `0016` are the original CR Connect module migrations, unchanged.

`0017_college_site_and_admissions` (public website tables, admissions, faculty, news, events,
permission flags, and the admission/contact functions) was applied directly to the Aspire Query
project. Its SQL is stored in that project's migration history but is **not yet in this folder**.
Capture it before deploying anywhere else:

    supabase link --project-ref lqryvcdjpcqbetettmzz
    supabase db pull

`0018` to `0021` add the principal fields and auto-publish date, restrict which database
functions anonymous visitors can call, and let class managers create subjects.

- 0023_section_subject_teachers.sql: teachers per section for each subject (run once in the Supabase SQL editor).

- `0024_gallery_and_multiple_images.sql` — adds the Gallery (albums) and extra photographs for news and events. Run once in the Supabase SQL Editor. Until it is run, the site works as before and the admin screens show a short note instead of the photo uploader.
- `0025_query_box.sql` — public "Ask Us" question box (identity options, attachments, tracking code) and its management inbox (Admissions → Questions). Run once in the Supabase SQL Editor (then run 0026). It also creates the private `query-attachments` storage bucket.
- `0026_query_box_hardening.sql` — run after 0025: upload limits, per-visitor rate limits for sending questions and checking tracking codes, and checks that attached files really exist.
