# AI writing assistant

A "Write with AI" link appears under the description fields in the portal. It drafts text from the facts you give it; you read it, edit it and choose whether to use it. Nothing is saved until you press Save on the form.

## Where it appears
| Field | Needs permission |
|---|---|
| Faculty: short profile | `manage_faculty` |
| News: short description, full text | `manage_content` |
| Events: description | `manage_content` |
| Programs: description, eligibility | `manage_content` |
| Website Content > Page text (home statement, about, vision, mission, philosophy, academics, student life, all admission points) | `manage_content` |
| Website & Branding: principal's message | Super Admin |

The Super Admin can use all of them. Principals, CRs and students never see it. This is enforced on the server, not only in the interface.

## What it does
- **Write from key points**: you type facts in any order, roughly; it writes clean text from them and from the other fields on the form.
- **Improve my text**: fixes wording and flow, keeps your facts.
- **Make shorter**.

## Rules it follows
- It uses **only facts you supplied**. It does not invent names, numbers, dates, fees, achievements, rankings or history.
- Where an essential detail is missing (a fee, a date) it writes `[TO BE PROVIDED]`.
- It refuses to write when you have given it too little to work from, and tells you what to add.
- After writing, the server checks the draft for numbers and claim words ("award", "ranked", "accredited", "leading" and similar) that were **not** in what you gave it, and shows a yellow "Check before using" box. Always read the draft before using it.

## One-time setup (the administrator)
1. Create an API key in Google AI Studio (https://aistudio.google.com/apikey). Keep it private and, in Google Cloud, restrict it or set a quota/budget alert so cost can never surprise you.
2. In the Supabase dashboard for the project: Edge Functions > Secrets > add
   - `GEMINI_API_KEY` = your key
   - (optional) `AI_WRITER_MODEL` = a different Gemini model name. The default is `gemini-3.8-flash`; if Google retires a name the function falls back to `gemini-flash-latest`.
3. Nothing else to deploy: the `ai-writer` function is already deployed. Secrets apply to the next request.

The key lives only in Supabase. It is never sent to the browser.

## Privacy
When someone uses the assistant, the text they typed and the related form fields (for example a faculty member's name, designation, department, subject and qualification; a news title) are sent to Google AI's API to produce the draft. Email addresses, phone numbers and student records are never sent. The application does not store the drafts.

## Messages you may see
| Message | Meaning |
|---|---|
| "The AI writer is not set up yet..." | The `GEMINI_API_KEY` secret has not been added. |
| "The AI service rejected the request..." | The key is wrong, expired or out of credit. Check it in the Google AI console. |
| "The AI service is busy..." | Too many requests at once. Wait a minute. |
| "You do not have permission..." | The account lacks `manage_content` / `manage_faculty`. |
| A request for more information | You gave too little to write accurately; add the facts it names. |

## Tests
`npx tsx supabase/functions/ai-writer/logic.test.mts` runs 49 checks (permissions, validation, prompt safety, the invented-fact warnings, error handling) with no network and no API key.

## Where the assistant appears

Faculty profile; news summary and article; event and program descriptions and eligibility; Principal's message; every Website Content page-text and Admissions-list section; the Description of each list item (core values, strengths, student-life items); and the Tagline and Footer text in Website & Branding.

It is deliberately **not** offered on operational text (concerns, queries, attendance notes, contact and application forms, announcements), where the author's own words matter.
