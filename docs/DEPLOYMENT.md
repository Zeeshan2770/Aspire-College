# Deployment guide

## 1. Backend (Supabase project "Aspire Query")
Already provisioned:
- Database schema and row-level security (migrations 0001 to 0021)
- Storage buckets: `avatars`, `report-logos`, `concern-attachments`, `site-media`
- Edge functions: `create-user`, `manage-cr-credentials`, `manage-student-credentials`, `smart-csv-assist`

Also deployed: `ai-writer` (the AI writing assistant; see `docs/AI_WRITER_SETUP.md`; it needs the `GEMINI_API_KEY` secret before it works).

Manual settings in the Supabase dashboard:
1. Authentication > Sign In / Providers > Email: turn **off** "Allow new users to sign up" (accounts are created by admins).
2. Authentication > URL Configuration: set **Site URL** to the deployed website address.
3. Optional: add the secret `OPENAI_API_KEY` to enable AI Assist in the CSV import. Without it the feature reports it is not configured.

## 2. Frontend (Netlify)
1. Push this project to a Git repository.
2. Create a Netlify site from it. Build command `npm run build`, publish directory `dist`.
3. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (copy from `.env.example`; use the anon key).
4. `public/_redirects` and `netlify.toml` already route all paths to the single-page app.

## 3. First-time content
1. Sign in as the Super Admin.
2. Website & Branding: college details, logo, colors, principal.
3. Website Content: programs, page text, news, events.
4. Faculty: add faculty and set "show on website".
5. Classes & Sections: create classes and sections, then assign class teachers and subjects.
6. Settings > Sub Admins: create Administration accounts and tick only the permissions each needs.

## 4. Local development
    npm install
    cp .env.example .env     # then fill in the anon key
    npm run dev

## 5. Troubleshooting
| Symptom | Cause and fix |
|---|---|
| Message "This website is not configured yet" | The two environment variables were missing when the site was built. Add them (see `NETLIFY_ENVIRONMENT_VARIABLES.txt`) and redeploy. |
| Toast "Invalid API key" on sign-in | `VITE_SUPABASE_ANON_KEY` is wrong, usually a copy error. A valid key has exactly three parts separated by dots. Copy it from the text file, or from Supabase > Project Settings > API (the `anon` key), then redeploy. |
| A page fails on the first click after you redeploy, and works after a refresh | A tab opened before the deploy still points at files the new deploy deleted. The site now reloads itself once to recover. If a visitor ever sees "This page has been updated", they only need to press Reload. |
| Login says "This account is not a ... account" | The person chose a different role in the Portal Login menu than their account actually has. Use the role selector on the login page. |
