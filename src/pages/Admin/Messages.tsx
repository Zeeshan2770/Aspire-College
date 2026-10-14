import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, ExternalLink, Mail, MessageCircle, Pencil, Plus, Smartphone, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Modal, PageHeading } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { fetchSiteContent, fetchSiteSettings } from '@/public/api';
import { Field, textareaCls } from './shared';
import {
  BUILT_IN_TEMPLATES, MessageTemplate, OPTIONAL_FIELDS, fill, hasUnfilled, isEmail, labelFor, loadCustomTemplates, mailtoLink, fetchSharedTemplates, upsertSharedTemplate, deleteSharedTemplate,
  normalizePhone, placeholdersOf, saveCustomTemplates, smsLink, whatsappLink,
} from '@/services/messageTemplates';

type Channel = 'email' | 'whatsapp' | 'sms';
const CHANNELS: { key: Channel; label: string; icon: typeof Mail }[] = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'sms', label: 'SMS', icon: Smartphone },
];
// Filled in automatically, still editable.
const AUTO = new Set(['college', 'campus', 'sender', 'contact_line', 'website', 'status_link', 'track_link', 'documents', 'important_dates', 'fee_info']);
// Fields that really want more than one line.
const LONG = new Set(['message', 'answer', 'documents', 'notes', 'question', 'important_dates', 'fee_info']);

/** Turns a website content block ({text} or {items}) into plain text for a message. */
function blockText(v?: { text?: string; items?: unknown[] }): string {
  const items = (v?.items ?? []).filter((i): i is string => typeof i === 'string' && i.trim() !== '');
  return items.length ? items.map((i) => `- ${i}`).join('\n') : (v?.text ?? '').trim();
}

function TemplateEditor({ row, onClose, onSave }: { row: MessageTemplate | null; onClose: () => void; onSave: (t: MessageTemplate) => void }) {
  const [name, setName] = useState(row?.name ?? '');
  const [subject, setSubject] = useState(row?.subject ?? '');
  const [body, setBody] = useState(row?.body ?? '');
  const [err, setErr] = useState<string | null>(null);
  function save() {
    if (!name.trim()) return setErr('Give the template a name.');
    if (!body.trim()) return setErr('Write the message text.');
    onSave({ id: row && !row.builtIn ? row.id : `custom-${Date.now()}`, name: name.trim(), subject: subject.trim(), body });
  }
  const used = placeholdersOf(subject, body);
  return (
    <Modal open onClose={onClose} title={row ? (row.builtIn ? 'Customise template' : 'Edit template') : 'New template'} wide>
      <div className="space-y-4">
        <Field label="Template name *"><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fee reminder" /></Field>
        <Field label="Email subject" hint="Used for email only."><Input value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="Message *" hint="Write a placeholder as {{name}}, {{program}}, {{date}} … Each one becomes a box to fill in. {{college}} and {{sender}} fill themselves.">
          <textarea rows={10} className={textareaCls} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {used.length > 0 && <p className="text-xs text-[var(--text-2)]">Fields found: {used.map(labelFor).join(', ')}</p>}
        {err && <p role="alert" className="text-sm font-medium text-red-700">{err}</p>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save template</Button></div>
      </div>
    </Modal>
  );
}

export default function MessagesPage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const [custom, setCustom] = useState<MessageTemplate[]>(() => loadCustomTemplates());
  const [shared, setShared] = useState(false); // true when templates are stored in the database and visible to every admin
  useEffect(() => {
    fetchSharedTemplates().then((list) => {
      if (!list) return;
      // First time: carry this browser's own templates into the shared list.
      const local = loadCustomTemplates().filter((l) => !list.some((d) => d.id === l.id));
      local.forEach((l) => { void upsertSharedTemplate(l); });
      setShared(true); setCustom([...list, ...local]);
    });
  }, []);
  const all = useMemo(() => [...BUILT_IN_TEMPLATES, ...custom], [custom]);
  const [tid, setTid] = useState(params.get('template') ?? BUILT_IN_TEMPLATES[0].id);
  const tpl = all.find((t) => t.id === tid) ?? all[0];
  const [channel, setChannel] = useState<Channel>(params.get('channel') === 'whatsapp' ? 'whatsapp' : params.get('channel') === 'sms' ? 'sms' : 'email');
  const [to, setTo] = useState(params.get('to') ?? '');
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    params.forEach((val, k) => { if (!['template', 'channel', 'to'].includes(k)) v[k.toLowerCase()] = val; });
    return v;
  });
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null);

  // College name and sender are filled in for you.
  // Details taken from the website's own settings and content. Anything already supplied (for example from an application) wins.
  useEffect(() => {
    const origin = window.location.origin;
    const base: Record<string, string> = { website: origin, status_link: `${origin}/admissions/status`, track_link: `${origin}/ask/track` };
    const merge = (add: Record<string, string>) => setValues((v) => { const n = { ...v }; for (const [k, val] of Object.entries(add)) if (val && n[k] === undefined) n[k] = val; return n; });
    merge(base);
    fetchSiteSettings().then((s) => merge({
      college: s.college_name, campus: s.campus_name,
      contact_line: [s.phone, s.email].filter(Boolean).join(' | '),
    })).catch(() => {});
    fetchSiteContent().then((c) => merge({
      documents: blockText(c.admission_documents), important_dates: blockText(c.admission_dates), fee_info: blockText(c.admission_fees),
    })).catch(() => {});
  }, []);
  useEffect(() => { if (profile?.full_name) setValues((v) => ({ ...v, sender: v.sender ?? profile.full_name })); }, [profile?.full_name]);

  const fields = useMemo(() => placeholdersOf(tpl.subject, tpl.body), [tpl]);
  const subject = fill(tpl.subject, values);
  const body = fill(tpl.body, values);
  const digits = channel === 'email' ? null : normalizePhone(to);
  const recipientOk = channel === 'email' ? isEmail(to) : !!digits;
  const unfilled = hasUnfilled(body) || (channel === 'email' && hasUnfilled(subject));

  function persist(next: MessageTemplate[], changed?: MessageTemplate, removedId?: string) {
    setCustom(next);
    if (shared) {
      const op = changed ? upsertSharedTemplate(changed) : removedId ? deleteSharedTemplate(removedId) : Promise.resolve(true);
      op.then((ok) => { if (!ok) toast.error('Could not save to the shared list. Check that migration 0028 has been run.'); });
      return;
    }
    if (!saveCustomTemplates(next)) toast.error('This browser could not save the template, so it will be lost when you leave.');
  }
  function onSave(t: MessageTemplate) {
    persist(custom.some((c) => c.id === t.id) ? custom.map((c) => (c.id === t.id ? t : c)) : [...custom, t], t);
    setTid(t.id); setEditing(null); toast.success('Template saved.');
  }
  function remove(t: MessageTemplate) {
    if (!confirm(`Delete the template "${t.name}"?`)) return;
    persist(custom.filter((c) => c.id !== t.id), undefined, t.id);
    if (tid === t.id) setTid(BUILT_IN_TEMPLATES[0].id);
  }

  function send() {
    if (!recipientOk) return toast.error(channel === 'email' ? 'Enter a valid email address.' : 'Enter a valid phone number (for example 0300 1234567).');
    if (unfilled && !confirm('Some details are still empty and will be sent as [Placeholders]. Continue anyway?')) return;
    const url = channel === 'email' ? mailtoLink(to, subject, body) : channel === 'whatsapp' ? whatsappLink(digits!, body) : smsLink(digits!, body);
    if (channel === 'whatsapp') window.open(url, '_blank', 'noopener,noreferrer'); else window.location.href = url;
  }
  async function copy() {
    try { await navigator.clipboard.writeText(channel === 'email' ? `Subject: ${subject}\n\n${body}` : body); toast.success('Message copied.'); }
    catch { toast.error('Could not copy. Select the preview text and copy it manually.'); }
  }

  return (
    <DashboardLayout>
      <PageHeading title="Message Center" description="Pick a template, fill in the details, then send it from your own email, WhatsApp or SMS." />
      <div className="grid gap-5 lg:grid-cols-[17rem_1fr]">
        {/* Templates */}
        <Card className="h-fit p-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="font-display text-sm font-bold text-ink-900">Templates</h2>
            <Button size="sm" variant="secondary" onClick={() => setEditing('new')}><Plus size={14} /> New</Button>
          </div>
          <ul className="space-y-0.5" aria-label="Message templates">
            {all.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setTid(t.id)} aria-current={t.id === tpl.id} className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${t.id === tpl.id ? 'bg-brand-50 text-brand-700' : 'text-[#41516B] hover:bg-[#EEF2F9]'}`}>
                  {t.name}{!t.builtIn && <span className="ml-1.5 text-[10px] font-semibold text-[var(--text-2)]">custom</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2 border-t border-[var(--border)] px-1 pt-3">
            <Button size="sm" variant="ghost" onClick={() => setEditing(tpl)}><Pencil size={14} /> {tpl.builtIn ? 'Customise' : 'Edit'}</Button>
            {!tpl.builtIn && <Button size="sm" variant="ghost" onClick={() => remove(tpl)}><Trash2 size={14} /> Delete</Button>}
          </div>
          <p className="mt-3 px-2 text-[11px] leading-relaxed text-[var(--text-2)]">Custom templates are saved in this browser only.</p>
        </Card>

        {/* Compose */}
        <div className="space-y-5">
          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Send by">
              {CHANNELS.map((c) => (
                <button key={c.key} type="button" aria-pressed={channel === c.key} onClick={() => setChannel(c.key)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${channel === c.key ? 'border-transparent bg-brand-800 text-white' : 'border-[#CBD5E4] bg-white text-[#41516B] hover:border-[#AEBBD0]'}`}>
                  <c.icon size={16} /> {c.label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              <Label>{channel === 'email' ? 'Send to (email address)' : 'Send to (phone number)'}</Label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} inputMode={channel === 'email' ? 'email' : 'tel'} placeholder={channel === 'email' ? 'name@example.com' : '0300 1234567 or +92 300 1234567'} aria-invalid={!!to && !recipientOk} />
              {to && !recipientOk && <p className="mt-1 text-xs font-medium text-red-700">{channel === 'email' ? 'This does not look like an email address.' : 'Enter the full number, including the area or mobile code.'}</p>}
              {channel !== 'email' && digits && <p className="mt-1 text-xs text-[var(--text-2)]">Will be sent to +{digits}</p>}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {fields.map((k) => (
                <div key={k} className={LONG.has(k) ? 'sm:col-span-2' : ''}>
                  <Label>{labelFor(k)}{OPTIONAL_FIELDS.has(k) ? ' (optional)' : AUTO.has(k) ? ' (filled in for you)' : ''}</Label>
                  {LONG.has(k)
                    ? <textarea rows={3} className={textareaCls} value={values[k] ?? ''} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />
                    : <Input value={values[k] ?? ''} onChange={(e) => setValues({ ...values, [k]: e.target.value })} />}
                </div>
              ))}
              {!fields.length && <p className="text-sm text-[var(--text-2)] sm:col-span-2">This template has no fields to fill in.</p>}
            </div>
          </Card>

          <Card className="p-4 sm:p-6">
            <h2 className="font-display text-sm font-bold text-ink-900">Preview</h2>
            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 sm:p-5">
              {channel === 'email' && <p className="mb-3 border-b border-[var(--border)] pb-3 text-sm"><span className="font-semibold text-[var(--text-2)]">Subject: </span><span className="font-semibold text-ink-900">{subject}</span></p>}
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-900">{body}</p>
            </div>
            {unfilled && <p className="mt-2 text-xs font-medium text-amber-800">Some details in [brackets] are still empty.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={send} disabled={!to}>
                {channel === 'email' ? <Mail size={16} /> : channel === 'whatsapp' ? <MessageCircle size={16} /> : <Smartphone size={16} />}
                {channel === 'email' ? 'Open in email app' : channel === 'whatsapp' ? 'Open WhatsApp' : 'Open SMS app'} <ExternalLink size={14} />
              </Button>
              <Button variant="secondary" onClick={copy}><Copy size={16} /> Copy message</Button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--text-2)]">This opens your own app with the message ready. Press Send there to deliver it. Nothing is sent automatically, and nothing is stored.</p>
          </Card>
        </div>
      </div>
      {editing && <TemplateEditor row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={onSave} />}
    </DashboardLayout>
  );
}
