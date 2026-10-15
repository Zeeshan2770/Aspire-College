# Zeeshan HQ — go-live guide

The backend is already live on Supabase (project `zeeshan-hq`, ref `fzxedipikmmpxcbrartr`, Mumbai).
Schema, row-level security, storage bucket, the `notify-email` function and your content are in place.

## 1. Run it locally
```
npm install
npm run dev        # http://localhost:5173
```
`.env.local` is already filled in with the project URL and the public anon key.

## 2. Add your photo (centred hero portrait)
Your photo sits large in the centre of the hero. The headline overlaps its left side and your intro paragraph sits on its right,
like a magazine cover. It is animated: it rises in on load, floats gently, tilts and drifts with the mouse, catches a moving light
sweep, and eases away as you scroll. Orbit rings, a glow and two floating chips add depth. All motion stops for visitors who
use the "reduce motion" setting, and on touch screens the mouse effects simply don't run.
- Change it any time, no code: sign in at `/admin` -> Settings -> **Profile image** -> upload. It updates instantly.
- Or put a file named `portrait.webp` into `/public`.
Best photo: portrait orientation, about 1600 x 2000 px, head in the upper third, shoulders visible, under 400 KB (WebP).
Ideal is a CUT-OUT with a transparent background (PNG/WebP). A photo with a plain studio background also works because all
four edges fade softly into the dark scene, but a very bright or white backdrop will look like a glowing panel, so use a
dark or neutral backdrop, or remove the background first. Until a photo exists a large "ZH" monogram is shown.

## 3. Deploy to Netlify
1. Push this folder to a GitHub repository.
2. Netlify -> Add new site -> Import from Git (build command and publish folder come from `netlify.toml`).
3. Site settings -> Environment variables, add:
   - `VITE_SUPABASE_URL`  = https://fzxedipikmmpxcbrartr.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = (the anon key from `.env.local`)
   - `VITE_SITE_URL` = your final https URL
   (`.env.local` is git-ignored on purpose, so Netlify needs these.)
4. Supabase dashboard -> Authentication -> URL configuration: set Site URL and add your Netlify URL as a redirect.
5. Authentication -> turn OFF "Allow new users to sign up" once your admin account exists.

## 4. Admin
Sign in at `/admin` with your account (already `super_admin`). Manage projects, case studies, screenshots (Media),
services, journey, blogs, payments, testimonials, inquiries, bookings and settings.
Screenshots currently live in `/public/projects`; new ones can be uploaded through Media.

## 5. Still needs you
- Confirm per project: role/scope, verified technologies, and real status.
- Email, phone/WhatsApp (Settings), if you want them shown.
- Email alerts: use the Phase 8 setup at the bottom of this file (Netlify + Resend). The older `supabase/functions/notify-email` webhook is superseded; if you already deployed it, delete its Database Webhook so you do not get two alerts.
- Privacy Policy and Terms: review the wording against what you actually collect.

## 6. What makes the site dynamic (and how to tune it)
- Opening screen once per browser session (click or any key skips). Remove by deleting `<Intro .../>` in `src/components/Layout.jsx`.
- Hero: headline words animate in, a rotating "Right now I build ..." line (edit `BUILDING` in `src/pages/Home.jsx`),
  a live particle network that reacts to the mouse, and your photo with parallax. Photo is changed in Admin -> Settings.
- Featured projects stack over each other as you scroll; cards tilt toward the cursor and glow under it.
- Buttons lean toward the cursor; section content slides in from different directions.
- Timeline line draws as you scroll; scroll progress bar; nav hides while reading; back-to-top button.
- Page-to-page fade transitions. Press Ctrl+K (or Cmd+K) anywhere to search pages and projects.
- All of it is switched off automatically for visitors who use the "reduce motion" system setting,
  and pointer effects only run on devices with a real mouse.

## 7. Payments (manual: Easypaisa, JazzCash, bank transfer, Raast)
How it works: the visitor opens `/pay`, picks a method, sees YOUR account details, sends the money from their own app/bank,
then submits a short form with the transaction ID. You check your account and mark the payment Verified in the admin.
No money moves through the website and no gateway keys are involved.
1. New Supabase project only: run `supabase/phase5_payments.sql` (already applied to the current project).
2. Admin -> Payment Methods: open each method, fill in account title and number (and bank name for bank transfer),
   edit the instructions if you like, and switch **Enabled** on. Methods stay hidden until enabled.
3. Admin -> Payments: new submissions appear as Pending (the menu shows a count). Verify them against your account.
   Reusing the same transaction ID is blocked automatically.
Automatic checkout (Easypaisa/JazzCash merchant gateways or cards) is not included: it needs a merchant account and
secret keys, and must be built and tested against the provider's sandbox.

## 8. Blogs
Public address: `/blog` (old `/insights` links redirect). Write posts in Admin -> Blogs. In the content box you can use
`## Heading`, `- list`, `1. numbered`, `> quote`, `**bold**`, `*italic*`, `` `code` ``, `[text](https://link)` and ``` fenced code blocks.
Readers get search, category filters, a table of contents, share buttons and related posts. RSS feed: `/rss.xml`.

## 9. Navigation and chat button
The top bar is a fixed glass capsule that stays visible on every page (links are boxed pills, the current page is highlighted).
A green floating WhatsApp button shows at the bottom-right of every page. Admin -> Settings -> Contact & social controls it: the WhatsApp number
(any of 923001234567, +92 300 1234567 or 0300 1234567 works), an on/off switch ("Floating WhatsApp button"), and the pre-filled first message.
With no number saved, or with the switch off, the button is hidden.

## 10. Short screen recordings for projects
Project cards play a small muted looping clip when they scroll into view (the still screenshot shows until it plays), and the case study
page shows the clip with a player. A clip never loads until it is on screen, pauses when you scroll away, and visitors who use
"reduce motion" or Data Saver just see the still image.
1. Record 6-12 seconds of the real project (Windows: Win+G Game Bar or Snipping Tool's recorder, Mac: Cmd+Shift+5, phone: built-in screen
   recording, or OBS). Show ONE clear thing: a scroll, a click-through, a quiz being answered.
   Do not record passwords, private student/customer data or personal emails.
2. Make it small: drag the recording onto `tools/make-clip.bat` (Windows) or run `tools/make-clip.sh recording.mp4` (Mac/Linux). Needs ffmpeg
   installed. The result is a silent MP4 around 1-3 MB.
3. Admin -> Media -> "Upload images or clips" (MP4 or WebM, max 12 MB and 30 seconds; a preview image is created automatically).
4. On the new clip press **Copy project line**, open the project in Admin -> Projects, and paste the line into the **Media** box.
   The first video in that list also plays on the project's card.
New Supabase project only: run `supabase/phase6_video.sql` (already applied to the current one).

## Phase 7 — light theme, SEO, responsive polish, website dropdown

1. **Run `supabase/phase7_seo.sql`** once in the Supabase SQL editor (safe to re-run). It adds `seo_title`, `seo_description`, `og_image`, `noindex` to `projects` and `insights`. Until it runs, the site still works (sitemap/share previews fall back), but the per-record SEO fields in the admin won't save.
2. **Theme**: visitors get a sun/moon switch in the nav (and in the admin sidebar). Choice is remembered in the browser; first visit follows the dark default.
3. **SEO** (Admin → Settings → "SEO & footer"): title template (`%s — %name`), default description, share image, keywords, locale, X handle, Google/Bing verification codes, extra `<meta name>` tags, "hide whole site from search", and per-page overrides (title / description / image / noindex). Projects and blog posts have their own "SEO" section in their editors. `noindex` pages are also dropped from `/sitemap.xml`.
4. **Start-a-project form**: "Do you already have a website?" is now a dropdown; the URL field only appears (and is only required) when the answer is Yes.
5. **Responsive**: layouts verified from 320px to 1180px+ (no horizontal scroll); hero portrait is re-cropped on phones.

## Phase 8 — structured data, pre-rendering, email alerts

**1. Run `supabase/phase8_email.sql`** once in the Supabase SQL editor (safe to re-run). It adds `notified_at` columns and one function, `claim_notification`, that lets the site announce a *fresh* submission exactly once. No service-role key is used anywhere.

**2. Structured data (JSON-LD)** is automatic: Person + WebSite on every page, breadcrumbs, `BlogPosting` for blog posts, `CreativeWork` for projects, plus About / Contact / list-page types. Nothing is invented (no ratings, prices or reviews). Check it with Google's Rich Results Test after deploy.

**3. Pre-rendering** runs as part of `npm run build` (Netlify does this for you). Every public page, project and blog post is written as real HTML, so crawlers that don't run JavaScript still see the title, headings, text and links. The app takes over as normal for visitors. It reads your published content from Supabase at build time, so **trigger a new deploy after publishing a lot of new content** (Netlify → Deploys → Trigger deploy). `VITE_SITE_URL` must be set so canonical URLs, `robots.txt` and the sitemap point at your real domain. Old `/insights/...` links now 301-redirect to `/blog/...`.

**4. Email alerts** (owner alert + short "I received it" confirmation to the visitor). Uses Resend (free tier is enough):
1. Create an account at resend.com and add your domain (Domains → Add; copy the DNS records it shows into your domain's DNS).
2. API Keys → create a key.
3. Netlify → Site configuration → Environment variables, add:
   - `RESEND_API_KEY` = the key (enter it only there, never in chat or code)
   - `NOTIFY_FROM` = `Your Name <hello@yourdomain.com>` (an address on the domain you verified)
   - `NOTIFY_TO_EMAIL` = where alerts should arrive (optional; otherwise the email from Admin → Settings → Site & brand)
4. Redeploy. Switches live in Admin → Settings → **Email alerts**.

Notes: until a domain is verified, Resend only lets you send to your own account email, so the visitor confirmation will not be delivered; owner alerts to that same address do work for testing. If email is not configured nothing breaks: submissions still appear in Leads, Messages and Appointments, and nothing is lost. Failures are logged in Netlify → Functions → notify.

## Phase 10 — community-service testimonials

1. **Run `supabase/phase10_testimonials.sql`** once in the Supabase SQL editor (safe to re-run). Run it *before* deploying the new front end, because the public testimonials query now asks for the new columns.
2. In Admin → Testimonials you now have *Community service details* (public) and *Private notes* (never shown). Tick **Verified** only after you have confirmed the testimonial with its author.
3. Submissions from the form arrive unpublished, with the name already shortened/anonymised if the author asked for that. Your notification shows the real name.
