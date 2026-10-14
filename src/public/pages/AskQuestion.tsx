import { saveTracking } from '../myTracking';
import { FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Copy, Paperclip, X } from 'lucide-react';
import { IDENTITIES, MAX_FILES, MAX_FILE_BYTES, PublicQueryInput, QUERY_TOPICS, QueryAttachment, VISIBILITIES, submitQuery, uploadQueryFile } from '@/services/queries';
import { PageHeader, Section, btnPrimary, btnSecondary } from '../components';

const PHONE = /^[0-9+\-\s]{10,16}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const empty: PublicQueryInput = { identity_type: 'STUDENT', visibility: 'FULL', name: '', email: '', phone: '', roll_no: '', class_name: '', category: '', subject: '', message: '', website: '' };

export default function AskQuestion() {
  const [f, setF] = useState<PublicQueryInput>(empty);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof PublicQueryInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const cls = (_bad: boolean) => 'field';
  const Err = ({ k }: { k: string }) => (errors[k] ? <p id={`q-${k}-err`} role="alert" className="field-error">{errors[k]}</p> : null);
  const lbl = 'field-label';
  const star = <span className="text-[var(--err)]" aria-hidden="true"> *</span>;

  const showName = f.visibility !== 'ANONYMOUS';
  const showContact = f.visibility === 'FULL';
  const showSchoolInfo = f.visibility === 'FULL' && (f.identity_type === 'STUDENT' || f.identity_type === 'PARENT');

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) { problems.push(`You can attach up to ${MAX_FILES} files.`); break; }
      if (!ALLOWED.includes(file.type)) { problems.push(`${file.name}: only JPG, PNG, WebP or PDF files are allowed.`); continue; }
      if (file.size > MAX_FILE_BYTES) { problems.push(`${file.name}: larger than 5 MB.`); continue; }
      next.push(file);
    }
    setFiles(next);
    setErrors((p) => ({ ...p, files: problems.join(' ') }));
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitError(null);
    const e: Record<string, string> = {};
    if (showName && !f.name.trim()) e.name = 'Enter your name.';
    if (showContact) {
      if (!f.email.trim() && !f.phone.trim()) e.email = 'Provide an email address or phone number so we can reach you.';
      if (f.email.trim() && !EMAIL.test(f.email.trim())) e.email = 'Enter a valid email address.';
      if (f.phone.trim() && !PHONE.test(f.phone.trim())) e.phone = 'Enter a valid phone number (10 to 16 digits).';
    }
    if (!f.category) e.category = 'Choose a topic.';
    if (!f.subject.trim()) e.subject = 'Enter a short subject.';
    if (!f.message.trim()) e.message = 'Write your question.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(files.length ? 'Uploading attachments…' : 'Sending…');
    try {
      const uploaded: QueryAttachment[] = [];
      for (const file of files) uploaded.push(await uploadQueryFile(file));
      setBusy('Sending…');
      const payload: PublicQueryInput = {
        ...f,
        name: showName ? f.name.trim() : '',
        email: showContact ? f.email.trim() : '',
        phone: showContact ? f.phone.trim() : '',
        roll_no: showSchoolInfo ? f.roll_no.trim() : '',
        class_name: showSchoolInfo ? f.class_name.trim() : '',
        subject: f.subject.trim(),
        message: f.message.trim(),
      };
      const newCode = await submitQuery(payload, uploaded);
      saveTracking('q', newCode);
      setCode(newCode);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(code ?? ''); setCopied(true); } catch { /* the code is visible and can be copied by hand */ }
  }

  if (code) {
    return (
      <>
        <PageHeader title="Ask a Question" subtitle="Your question has been received." />
        <Section>
          <div className="surface mx-auto max-w-xl p-8 text-center shadow-card sm:p-10">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--ok)]" aria-hidden="true" />
            <p className="mt-3 font-medium text-college-primary">Thank you. Your question has been sent.</p>
            <p className="mt-4 text-sm text-[var(--text-2)]">Your tracking code is</p>
            <p className="mt-2 select-all rounded-lg bg-[var(--soft-blue)] px-4 py-3 font-mono text-2xl font-semibold tracking-wider text-college-primary" data-testid="code">{code}</p>
            <button onClick={copy} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-college-primary hover:underline"><Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Copied' : 'Copy code'}</button>
            <p className="mt-4 text-sm text-[var(--text-2)]">Write this code down. It is the only way to see the answer{f.visibility === 'FULL' ? ' on this website' : ''}, and we cannot recover it for you.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to={`/ask/track?code=${encodeURIComponent(code)}`} className={btnPrimary}>Check the answer</Link>
              <button onClick={() => { setCode(null); setF(empty); setFiles([]); setCopied(false); }} className={btnSecondary}>Ask another question</button>
            </div>
          </div>
        </Section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Ask a Question" subtitle="Ask the college a question, share a concern or send a suggestion. You choose how much of your identity to share." />
      <Section>
        <div className="mx-auto max-w-2xl">
          <form onSubmit={onSubmit} noValidate className="space-y-8">
            <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>

            <fieldset>
              <legend className="mb-3 font-display text-h3 text-college-primary">1. Who are you?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {IDENTITIES.map((o) => (
                  <label key={o.value} className={`cursor-pointer rounded-lg border p-3.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-[rgb(var(--c-accent)/.4)] ${f.identity_type === o.value ? 'border-[rgb(var(--c-accent))] bg-[var(--soft-blue)]' : 'border-[#CBD5E4] bg-white hover:border-[#AEBBD0]'}`}>
                    <input type="radio" name="identity" className="sr-only" checked={f.identity_type === o.value} onChange={() => setF((p) => ({ ...p, identity_type: o.value }))} />
                    <span className="block font-medium text-[var(--text)]">{o.label}</span>
                    <span className="block text-xs text-[var(--text-2)]">{o.hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 font-display text-h3 text-college-primary">2. How much do you want to share about yourself?</legend>
              <div className="space-y-2">
                {VISIBILITIES.map((o) => (
                  <label key={o.value} className={`flex cursor-pointer gap-3 rounded-lg border p-3.5 text-sm transition-colors focus-within:ring-2 focus-within:ring-[rgb(var(--c-accent)/.4)] ${f.visibility === o.value ? 'border-[rgb(var(--c-accent))] bg-[var(--soft-blue)]' : 'border-[#CBD5E4] bg-white hover:border-[#AEBBD0]'}`}>
                    <input type="radio" name="visibility" className="mt-0.5" checked={f.visibility === o.value} onChange={() => { setF((p) => ({ ...p, visibility: o.value })); setErrors({}); }} />
                    <span><span className="block font-medium text-[var(--text)]">{o.label}</span><span className="block text-xs text-[var(--text-2)]">{o.hint}</span></span>
                  </label>
                ))}
              </div>
              {(showName) && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="q-name" className={lbl}>Name{star}</label>
                    <input id="q-name" value={f.name} onChange={set('name')} maxLength={120} className={cls(!!errors.name)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'q-name-err' : undefined} autoComplete="name" />
                    <Err k="name" />
                  </div>
                  {showContact && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="q-email" className={lbl}>Email</label>
                        <input id="q-email" type="email" value={f.email} onChange={set('email')} className={cls(!!errors.email)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'q-email-err' : undefined} autoComplete="email" />
                        <Err k="email" />
                      </div>
                      <div>
                        <label htmlFor="q-phone" className={lbl}>Phone</label>
                        <input id="q-phone" type="tel" value={f.phone} onChange={set('phone')} className={cls(!!errors.phone)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'q-phone-err' : undefined} autoComplete="tel" />
                        <Err k="phone" />
                      </div>
                    </div>
                  )}
                  {showSchoolInfo && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><label htmlFor="q-class" className={lbl}>Class and section (optional)</label><input id="q-class" value={f.class_name} onChange={set('class_name')} maxLength={80} className={cls(false)} /></div>
                      <div><label htmlFor="q-roll" className={lbl}>Roll number (optional)</label><input id="q-roll" value={f.roll_no} onChange={set('roll_no')} maxLength={40} className={cls(false)} /></div>
                    </div>
                  )}
                </div>
              )}
              {f.visibility === 'ANONYMOUS' && <p className="mt-3 rounded bg-[var(--bg)] px-3 py-2 text-xs text-[var(--text-2)]">No name, email or phone will be saved with this question. Please do not write personal details in the message either.</p>}
            </fieldset>

            <fieldset>
              <legend className="mb-3 font-display text-h3 text-college-primary">3. Your question</legend>
              <div className="space-y-4">
                <div>
                  <label htmlFor="q-category" className={lbl}>Topic{star}</label>
                  <select id="q-category" value={f.category} onChange={set('category')} className={cls(!!errors.category)} aria-invalid={!!errors.category} aria-describedby={errors.category ? 'q-category-err' : undefined}>
                    <option value="">Select a topic</option>
                    {QUERY_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Err k="category" />
                </div>
                <div>
                  <label htmlFor="q-subject" className={lbl}>Subject{star}</label>
                  <input id="q-subject" value={f.subject} onChange={set('subject')} maxLength={200} className={cls(!!errors.subject)} aria-invalid={!!errors.subject} aria-describedby={errors.subject ? 'q-subject-err' : undefined} />
                  <Err k="subject" />
                </div>
                <div>
                  <label htmlFor="q-message" className={lbl}>Message{star}</label>
                  <textarea id="q-message" rows={6} maxLength={4000} value={f.message} onChange={set('message')} className={cls(!!errors.message)} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'q-message-err' : undefined} />
                  <div className="flex justify-between"><Err k="message" /><span className="ml-auto mt-1 text-xs text-[#7A8AA3]">{f.message.length} / 4000</span></div>
                </div>
                <div>
                  <span className={lbl}>Attachments (optional)</span>
                  <p className="mb-2 text-xs text-[var(--text-2)]">Up to {MAX_FILES} files: JPG, PNG, WebP or PDF, 5 MB each. Only the college staff who answer questions can open them.</p>
                  {files.length > 0 && (
                    <ul className="mb-2 space-y-1.5">
                      {files.map((file, i) => (
                        <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#CBD5E4] px-3 py-1.5 text-sm">
                          <span className="min-w-0 truncate"><Paperclip className="mr-1.5 inline h-3.5 w-3.5 text-[#7A8AA3]" aria-hidden="true" />{file.name} <span className="text-xs text-[#7A8AA3]">({kb(file.size)})</span></span>
                          <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, k) => k !== i))} className="rounded p-1 text-[var(--text-2)] hover:bg-slate-100 hover:text-red-600"><X className="h-4 w-4" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <input ref={fileRef} id="q-files" type="file" multiple accept={ALLOWED.join(',')} className="sr-only" disabled={files.length >= MAX_FILES || !!busy} onChange={(e) => addFiles(e.target.files)} />
                  <label htmlFor="q-files" className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#CBD5E4] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--bg)] ${files.length >= MAX_FILES || busy ? 'pointer-events-none opacity-50' : ''}`}><Paperclip className="h-4 w-4" aria-hidden="true" /> Add files</label>
                  {errors.files && <p role="alert" className="field-error">{errors.files}</p>}
                </div>
              </div>
            </fieldset>

            {submitError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{submitError}</div>}
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" disabled={!!busy} className={btnPrimary}>{busy ?? 'Send Question'}</button>
              <Link to="/ask/track" className="link-arrow">Already asked? Check your answer</Link>
            </div>
          </form>
        </div>
      </Section>
    </>
  );
}
