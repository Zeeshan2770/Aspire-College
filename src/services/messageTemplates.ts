import { supabase } from '@/lib/supabase';
/**
 * Manual message templates for email / WhatsApp / SMS.
 * A template is plain text with {{placeholders}}. The Message Center asks for each placeholder, shows a live preview,
 * then opens the sender's own Email / WhatsApp / SMS app with the finished message. Nothing is sent from the server.
 * Custom templates are stored in this browser only (localStorage); the built-in ones below are always available.
 */
export interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  builtIn?: boolean;
}

const SIGN = '{{sender}}\n{{college}}, {{campus}}\n{{contact_line}}\n{{website}}';

export const BUILT_IN_TEMPLATES: MessageTemplate[] = [
  {
    id: 'adm-received', builtIn: true, name: 'Application received',
    subject: 'We have received your application {{application_no}}',
    body: `Dear {{name}},\n\nThank you for applying to {{program}} at {{college}}. Your application number is {{application_no}}.\n\nYou can check the progress of your application at any time here:\n{{status_link}}\nEnter your application number and the phone number you used on the form.\n\nWe will contact you once your application has been reviewed.\n\nRegards,\n${SIGN}`,
  },
  {
    id: 'adm-review', builtIn: true, name: 'Application under review',
    subject: 'Your application {{application_no}} is under review',
    body: `Dear {{name}},\n\nYour application {{application_no}} for {{program}} at {{college}} is now under review by the admissions office. We will let you know as soon as a decision has been made.\n\nYou can follow its status here:\n{{status_link}}\n\nRegards,\n${SIGN}`,
  },
  {
    id: 'adm-documents', builtIn: true, name: 'Documents required',
    subject: 'Documents required for application {{application_no}}',
    body: `Dear {{name}},\n\nTo continue with your application {{application_no}} for {{program}}, please bring or send the following documents by {{date}}:\n\n{{documents}}\n\n{{notes}}\n\nRegards,\n${SIGN}`,
  },
  {
    id: 'adm-accepted', builtIn: true, name: 'Admission accepted',
    subject: 'Admission decision for {{name}} · {{application_no}}',
    body: `Dear {{name}},\n\nCongratulations! Your application {{application_no}} for {{program}} at {{college}} has been accepted.\n\nTo complete your admission, please visit the admissions office by {{date}} with the following:\n{{documents}}\n\n{{important_dates}}\n\n{{fee_info}}\n\n{{notes}}\n\nWe look forward to welcoming you.\n\nRegards,\n${SIGN}`,
  },
  {
    id: 'adm-declined', builtIn: true, name: 'Admission not accepted',
    subject: 'Update on your application {{application_no}}',
    body: `Dear {{name}},\n\nThank you for your interest in {{college}}. After reviewing your application {{application_no}} for {{program}}, we are sorry to tell you that we are unable to offer you admission at this time.\n\n{{notes}}\n\nYou are welcome to contact the admissions office if you would like to know more.\n\nRegards,\n${SIGN}`,
  },
  {
    id: 'query-reply', builtIn: true, name: 'Reply to a question (Ask Us)',
    subject: 'Reply to your question {{tracking_code}}',
    body: `Dear {{name}},\n\nThank you for writing to {{college}}. About your question "{{question}}":\n\n{{answer}}\n\nYou can also read this reply on our website with your tracking code {{tracking_code}}:\n{{track_link}}\n\nRegards,\n${SIGN}`,
  },
  {
    id: 'contact-reply', builtIn: true, name: 'Reply to a contact message',
    subject: 'Re: {{subject}}',
    body: `Dear {{name}},\n\nThank you for contacting {{college}} about "{{subject}}".\n\n{{answer}}\n\nRegards,\n${SIGN}`,
  },
  {
    id: 'notice', builtIn: true, name: 'General notice',
    subject: '{{title}}',
    body: `Dear {{name}},\n\n{{message}}\n\nRegards,\n${SIGN}`,
  },
];

const KEY = 'aspire.msgTemplates.v1';

export function loadCustomTemplates(): MessageTemplate[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((t) => t && typeof t.id === 'string' && typeof t.body === 'string') : [];
  } catch { return []; }
}
export function saveCustomTemplates(list: MessageTemplate[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

// ---- Shared storage (optional): the message_templates table from migration 0028. Returns null when it is not set up. ----
export async function fetchSharedTemplates(): Promise<MessageTemplate[] | null> {
  try {
    const { data, error } = await supabase.from('message_templates').select('id,name,subject,body').order('updated_at');
    if (error || !data) return null;
    return data as MessageTemplate[];
  } catch { return null; }
}
export async function upsertSharedTemplate(t: MessageTemplate): Promise<boolean> {
  try {
    const { error } = await supabase.from('message_templates').upsert({ id: t.id, name: t.name, subject: t.subject, body: t.body, updated_at: new Date().toISOString() });
    return !error;
  } catch { return false; }
}
export async function deleteSharedTemplate(id: string): Promise<boolean> {
  try { const { error } = await supabase.from('message_templates').delete().eq('id', id); return !error; } catch { return false; }
}

/** Placeholder names used in a template, in first-seen order. */
export function placeholdersOf(...texts: string[]): string[] {
  const seen: string[] = [];
  for (const t of texts) for (const m of t.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi)) { const k = m[1].toLowerCase(); if (!seen.includes(k)) seen.push(k); }
  return seen;
}
export const labelFor = (key: string) => key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Fills placeholders; any left empty stay visible as [Label] so they are never sent by accident. */
/** Fields that may be left empty: they simply disappear instead of showing as [Placeholders]. */
export const OPTIONAL_FIELDS = new Set(['notes', 'important_dates', 'fee_info', 'contact_line']);

export function fill(text: string, values: Record<string, string>): string {
  return text
    .replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi, (_, k: string) => {
      const key = k.toLowerCase();
      const v = (values[key] ?? '').trim();
      return v || (OPTIONAL_FIELDS.has(key) ? '' : `[${labelFor(key)}]`);
    })
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n');
}
export const hasUnfilled = (text: string) => /\[[A-Z][^\]\n]*\]/.test(text);

/** Pakistani numbers: 0300… → 92300…; keeps other international numbers; returns digits only (what WhatsApp needs). */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, '');
  const plus = d.startsWith('+');
  d = d.replace(/\D/g, '');
  if (!plus && d.startsWith('00')) d = d.slice(2);
  else if (!plus && d.startsWith('0')) d = '92' + d.slice(1);
  return d.length >= 10 && d.length <= 15 ? d : null;
}
export const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

export const mailtoLink = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
export const whatsappLink = (digits: string, body: string) => `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
export const smsLink = (digits: string, body: string) => `sms:+${digits}?&body=${encodeURIComponent(body)}`;
