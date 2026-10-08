import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge, Button, Card, Input, Modal, Select, Spinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  AlbumRow, ContentValue, EventRow, NewsRow, deleteAlbum, listAlbums, saveAlbum, ProgramRow, replaceSiteImages, deleteEvent, deleteNews, listEvents, listNews,
  listPrograms, loadContent, saveContent, saveEvent, saveNews, saveProgram,
} from '@/services/website';
import { OptionSelect } from '@/components/OptionSelect';
import AiAssist from '@/components/AiAssist';
import { Checkbox, Field, ImageField, MultiImageField, useSiteImages, NoAccess, PAGE_SIZE, Pager, ReadOnlyNote, textareaCls } from './shared';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const nz = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);

function StatusBadge({ s }: { s: 'DRAFT' | 'PUBLISHED' }) {
  return <Badge tone={s === 'PUBLISHED' ? 'green' : 'slate'}>{s === 'PUBLISHED' ? 'Published' : 'Draft'}</Badge>;
}

function Err({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p> : null;
}

/* --------------------------------- News --------------------------------- */

function NewsForm({ row, onClose, onSaved }: { row: NewsRow | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: row?.title ?? '', summary: row?.summary ?? '', body: row?.body ?? '', image_url: row?.image_url ?? null as string | null, category: row?.category ?? 'General', status: (row?.status ?? 'DRAFT') as 'DRAFT' | 'PUBLISHED' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photos = useSiteImages('news', row?.id);
  async function submit() {
    if (!f.title.trim()) return setErr('Enter a title.');
    setBusy(true); setErr(null);
    try {
      const savedId = await saveNews(row?.id ?? null, { title: f.title.trim(), summary: nz(f.summary), body: nz(f.body), image_url: f.image_url, category: f.category, status: f.status });
      if (photos.state === 'ready') await replaceSiteImages('news', savedId, photos.images);
      toast.success(f.status === 'PUBLISHED' ? 'News saved and published.' : 'News saved as draft.');
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={row ? 'Edit news' : 'Add news'} wide>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Title *"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category"><OptionSelect category="news_category" title="Category" placeholder="Select category" allowEmpty={false} canManage value={f.category} onChange={(v) => setF({ ...f, category: v })} /></Field>
          <Field label="Status" hint="Only published items appear on the website."><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as 'DRAFT' | 'PUBLISHED' })}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></Select></Field>
        </div>
        <Field label="Short description">
          <textarea rows={2} maxLength={300} className={textareaCls} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
          <AiAssist kind="news_summary" context={{ title: f.title, category: f.category, article_text: f.body }} value={f.summary} maxChars={300} onApply={(t) => setF({ ...f, summary: t })} />
        </Field>
        <Field label="Full text" hint="Leave a blank line between paragraphs.">
          <textarea rows={7} className={textareaCls} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          <AiAssist
            kind="news_body"
            context={{ title: f.title, category: f.category, summary: f.summary }}
            value={f.body}
            onApply={(t) => setF({ ...f, body: t })}
            notesHint="What happened, when, where and who was involved. Include any names, dates and numbers you want mentioned."
          />
        </Field>
        <ImageField label="Main image" value={f.image_url} folder="news" onChange={(u) => setF({ ...f, image_url: u })} hint="Shown on the news card and at the top of the article." />
        {photos.state === 'ready' && <MultiImageField label="More photographs (optional)" folder="news" images={photos.images} onChange={photos.setImages} hint="Shown as a photo gallery under the article. Select several files at once; JPG, PNG or WebP, up to 2 MB each." />}
        {photos.state === 'unavailable' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Extra photographs are not switched on yet. The administrator needs to run the 0024 database script once.</p>}
        <Err msg={err} />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</Button></div>
      </div>
    </Modal>
  );
}

function NewsTab({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NewsRow | 'new' | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await listNews(page, PAGE_SIZE); setRows(r.rows); setTotal(r.total); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  async function toggle(n: NewsRow) {
    try { await saveNews(n.id, { title: n.title, summary: n.summary, body: n.body, image_url: n.image_url, category: n.category, status: n.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }); toast.success(n.status === 'PUBLISHED' ? 'Moved to drafts.' : 'Published.'); load(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function remove(n: NewsRow) {
    if (!window.confirm(`Delete "${n.title}"? This cannot be undone.`)) return;
    try { await deleteNews(n.id); toast.success('News deleted.'); load(); } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <>
      {canEdit && <div className="mb-4 flex justify-end"><Button onClick={() => setEditing('new')}><Plus size={16} /> Add news</Button></div>}
      <Card>
        {error ? <div className="p-8 text-center text-sm text-red-700" role="alert">{error} <button className="ml-2 underline" onClick={load}>Retry</button></div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Published</th><th className="px-4 py-3">Status</th>{canEdit && <th className="px-4 py-3 text-right">Actions</th>}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((n) => (<tr key={n.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-ink-900">{n.title}</td><td className="px-4 py-3 text-slate-600">{n.category}</td><td className="px-4 py-3 text-slate-600">{fmt(n.published_at)}</td><td className="px-4 py-3"><StatusBadge s={n.status} /></td>
                {canEdit && <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(n)}><Pencil size={14} /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(n)}>{n.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${n.title}`} onClick={() => remove(n)}><Trash2 size={14} /></Button></td>}
              </tr>))}
              {loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center"><Spinner className="mx-auto" /></td></tr>}
              {!loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No news has been added yet.</td></tr>}
            </tbody></table></div>)}
        <Pager page={page} total={total} onPage={setPage} />
      </Card>
      {editing && <NewsForm row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

/* -------------------------------- Events -------------------------------- */

function EventForm({ row, onClose, onSaved }: { row: EventRow | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: row?.title ?? '', description: row?.description ?? '', location: row?.location ?? '', starts: toLocalInput(row?.starts_at ?? null), ends: toLocalInput(row?.ends_at ?? null), image_url: row?.image_url ?? null as string | null, status: (row?.status ?? 'DRAFT') as 'DRAFT' | 'PUBLISHED' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photos = useSiteImages('event', row?.id);
  async function submit() {
    if (!f.title.trim()) return setErr('Enter a title.');
    if (!f.starts) return setErr('Enter the start date and time.');
    if (f.ends && new Date(f.ends) < new Date(f.starts)) return setErr('The end cannot be before the start.');
    setBusy(true); setErr(null);
    try {
      const savedId = await saveEvent(row?.id ?? null, { title: f.title.trim(), description: nz(f.description), location: nz(f.location), starts_at: new Date(f.starts).toISOString(), ends_at: f.ends ? new Date(f.ends).toISOString() : null, image_url: f.image_url, status: f.status });
      if (photos.state === 'ready') await replaceSiteImages('event', savedId, photos.images);
      toast.success('Event saved.'); onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={row ? 'Edit event' : 'Add event'} wide>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Title *"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts *"><Input type="datetime-local" value={f.starts} onChange={(e) => setF({ ...f, starts: e.target.value })} /></Field>
          <Field label="Ends"><Input type="datetime-local" value={f.ends} onChange={(e) => setF({ ...f, ends: e.target.value })} /></Field>
          <Field label="Location"><OptionSelect category="event_location" title="Location" placeholder="Select location" canManage value={f.location} onChange={(v) => setF({ ...f, location: v })} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as 'DRAFT' | 'PUBLISHED' })}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></Select></Field>
        </div>
        <Field label="Description">
          <textarea rows={4} className={textareaCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <AiAssist
            kind="event_description"
            context={{ title: f.title, location: f.location, date: f.starts ? new Date(f.starts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '' }}
            value={f.description}
            onApply={(t) => setF({ ...f, description: t })}
            notesHint="What the event is, who it is for, and anything people should know."
          />
        </Field>
        <ImageField label="Main image" value={f.image_url} folder="events" onChange={(u) => setF({ ...f, image_url: u })} hint="Shown on the event card." />
        {photos.state === 'ready' && <MultiImageField label="More photographs (optional)" folder="events" images={photos.images} onChange={photos.setImages} hint="Shown as a photo gallery with the event. Select several files at once; JPG, PNG or WebP, up to 2 MB each." />}
        {photos.state === 'unavailable' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Extra photographs are not switched on yet. The administrator needs to run the 0024 database script once.</p>}
        <Err msg={err} />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</Button></div>
      </div>
    </Modal>
  );
}

function EventsTab({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EventRow | 'new' | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await listEvents(page, PAGE_SIZE); setRows(r.rows); setTotal(r.total); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);
  async function remove(e: EventRow) {
    if (!window.confirm(`Delete "${e.title}"? This cannot be undone.`)) return;
    try { await deleteEvent(e.id); toast.success('Event deleted.'); load(); } catch (er) { toast.error((er as Error).message); }
  }
  return (
    <>
      {canEdit && <div className="mb-4 flex justify-end"><Button onClick={() => setEditing('new')}><Plus size={16} /> Add event</Button></div>}
      <Card>
        {error ? <div className="p-8 text-center text-sm text-red-700" role="alert">{error} <button className="ml-2 underline" onClick={load}>Retry</button></div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Status</th>{canEdit && <th className="px-4 py-3 text-right">Actions</th>}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((e) => (<tr key={e.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-ink-900">{e.title}</td><td className="px-4 py-3 text-slate-600">{fmt(e.starts_at)}</td><td className="px-4 py-3 text-slate-600">{e.location ?? '–'}</td><td className="px-4 py-3"><StatusBadge s={e.status} /></td>
                {canEdit && <td className="whitespace-nowrap px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(e)}><Pencil size={14} /> Edit</Button><Button size="sm" variant="ghost" aria-label={`Delete ${e.title}`} onClick={() => remove(e)}><Trash2 size={14} /></Button></td>}
              </tr>))}
              {loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center"><Spinner className="mx-auto" /></td></tr>}
              {!loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No events have been added yet.</td></tr>}
            </tbody></table></div>)}
        <Pager page={page} total={total} onPage={setPage} />
      </Card>
      {editing && <EventForm row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

/* ------------------------------- Programs ------------------------------- */

function ProgramForm({ row, onClose, onSaved }: { row: ProgramRow | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: row?.name ?? '', level: row?.level ?? '', duration: row?.duration ?? '', description: row?.description ?? '', eligibility: row?.eligibility ?? '', display_order: row?.display_order ?? 0, is_active: row?.is_active ?? true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    if (!f.name.trim()) return setErr('Enter the program name.');
    setBusy(true); setErr(null);
    try {
      await saveProgram(row?.id ?? null, { name: f.name.trim(), level: nz(f.level), duration: nz(f.duration), description: nz(f.description), eligibility: nz(f.eligibility), display_order: Number(f.display_order) || 0, is_active: f.is_active });
      toast.success('Program saved.'); onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={row ? 'Edit program' : 'Add program'} wide>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Program name *"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Level"><OptionSelect category="program_level" title="Level" placeholder="Select level" canManage value={f.level} onChange={(v) => setF({ ...f, level: v })} /></Field>
          <Field label="Duration"><OptionSelect category="program_duration" title="Duration" placeholder="Select duration" canManage value={f.duration} onChange={(v) => setF({ ...f, duration: v })} /></Field>
          <Field label="Display order"><Input type="number" value={f.display_order} onChange={(e) => setF({ ...f, display_order: Number(e.target.value) })} /></Field>
        </div>
        <Field label="Description">
          <textarea rows={3} className={textareaCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <AiAssist
            kind="program_description"
            context={{ name: f.name, level: f.level, duration: f.duration, eligibility: f.eligibility }}
            value={f.description}
            onApply={(t) => setF({ ...f, description: t })}
            notesHint="What students study, what the program leads to, and anything that makes it suitable for them."
          />
        </Field>
        <Field label="Eligibility">
          <textarea rows={2} className={textareaCls} value={f.eligibility} onChange={(e) => setF({ ...f, eligibility: e.target.value })} />
          <AiAssist
            kind="program_eligibility"
            context={{ name: f.name, level: f.level }}
            value={f.eligibility}
            onApply={(t) => setF({ ...f, eligibility: t })}
            notesHint="Type the requirement in your own words, e.g. the class passed and any marks needed."
          />
        </Field>
        <Checkbox label="Show on the website and in the admission form" checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} />
        <Err msg={err} />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save'}</Button></div>
      </div>
    </Modal>
  );
}

function ProgramsTab({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<ProgramRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProgramRow | 'new' | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await listPrograms()); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      {canEdit && <div className="mb-4 flex justify-end"><Button onClick={() => setEditing('new')}><Plus size={16} /> Add program</Button></div>}
      <Card>
        {error ? <div className="p-8 text-center text-sm text-red-700" role="alert">{error} <button className="ml-2 underline" onClick={load}>Retry</button></div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Program</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Website</th>{canEdit && <th className="px-4 py-3 text-right">Actions</th>}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (<tr key={p.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-ink-900">{p.name}</td><td className="px-4 py-3 text-slate-600">{p.level ?? '–'}</td><td className="px-4 py-3 text-slate-600">{p.duration ?? '–'}</td><td className="px-4 py-3"><Badge tone={p.is_active ? 'green' : 'slate'}>{p.is_active ? 'Shown' : 'Hidden'}</Badge></td>
                {canEdit && <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil size={14} /> Edit</Button></td>}
              </tr>))}
              {loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center"><Spinner className="mx-auto" /></td></tr>}
              {!loading && !rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No programs have been added yet.</td></tr>}
            </tbody></table></div>)}
      </Card>
      {editing && <ProgramForm row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

/* --------------------------------- Pages -------------------------------- */

type Kind = 'text' | 'list' | 'block';
const SECTIONS: { key: string; label: string; kind: Kind; page: string; hint?: string }[] = [
  { key: 'hero_statement', label: 'Home: institutional statement', kind: 'text', page: 'Home', hint: 'One or two sentences under the college name.' },
  { key: 'about_intro', label: 'About: introduction', kind: 'text', page: 'About / Home' },
  { key: 'vision', label: 'About: vision', kind: 'text', page: 'About' },
  { key: 'mission', label: 'About: mission', kind: 'text', page: 'About' },
  { key: 'core_values', label: 'About: core values', kind: 'list', page: 'About / Home' },
  { key: 'philosophy', label: 'About: educational philosophy', kind: 'text', page: 'About' },
  { key: 'why_aspire', label: 'Home: why Aspire (strengths)', kind: 'list', page: 'Home', hint: 'Only state strengths that are genuinely true. No statistics.' },
  { key: 'academic_structure', label: 'Academics: academic structure', kind: 'text', page: 'Academics' },
  { key: 'academic_support', label: 'Academics: academic support', kind: 'text', page: 'Academics' },
  { key: 'exam_info', label: 'Academics: examination information', kind: 'text', page: 'Academics' },
  { key: 'admission_eligibility', label: 'Admissions: eligibility', kind: 'block', page: 'Admissions' },
  { key: 'admission_procedure', label: 'Admissions: procedure', kind: 'block', page: 'Admissions' },
  { key: 'admission_documents', label: 'Admissions: required documents', kind: 'block', page: 'Admissions' },
  { key: 'admission_dates', label: 'Admissions: important dates', kind: 'block', page: 'Admissions' },
  { key: 'admission_fees', label: 'Admissions: fee information', kind: 'block', page: 'Admissions' },
  { key: 'student_life_intro', label: 'Student Life: introduction', kind: 'text', page: 'Student Life' },
  { key: 'student_life', label: 'Student Life: activities and sections', kind: 'list', page: 'Student Life' },
];

type Pair = { title: string; text: string };

function SectionEditor({ def, value, canEdit, onSaved }: { def: (typeof SECTIONS)[number]; value?: ContentValue; canEdit: boolean; onSaved: () => void }) {
  const initialItems = (value?.items ?? []) as unknown[];
  const [text, setText] = useState(def.kind === 'block' && initialItems.length ? (initialItems as string[]).join('\n') : value?.text ?? '');
  const [bullets, setBullets] = useState(def.kind === 'block' && initialItems.length > 0);
  const [pairs, setPairs] = useState<Pair[]>(def.kind === 'list' ? (initialItems as Pair[]).map((p) => ({ title: p.title ?? '', text: p.text ?? '' })) : []);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      let v: ContentValue;
      if (def.kind === 'list') v = { items: pairs.filter((p) => p.title.trim()).map((p) => ({ title: p.title.trim(), text: p.text.trim() })) };
      else if (def.kind === 'block' && bullets) v = { items: text.split('\n').map((l) => l.trim()).filter(Boolean) };
      else v = { text: text.trim() };
      await saveContent(def.key, v);
      toast.success('Saved.'); onSaved();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const move = (i: number, d: number) => setPairs((p) => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div><h3 className="font-semibold text-ink-900">{def.label}</h3>{def.hint && <p className="text-xs text-slate-500">{def.hint}</p>}</div>
        <Badge tone="slate">{def.page}</Badge>
      </div>
      {def.kind === 'list' ? (
        <div className="space-y-3">
          {pairs.map((p, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_auto]">
              <Input aria-label="Title" placeholder="Title" disabled={!canEdit} value={p.title} onChange={(e) => setPairs((x) => x.map((y, k) => (k === i ? { ...y, title: e.target.value } : y)))} />
              <div>
                <Input aria-label="Description" placeholder="Description" disabled={!canEdit} value={p.text} onChange={(e) => setPairs((x) => x.map((y, k) => (k === i ? { ...y, text: e.target.value } : y)))} />
                {canEdit && (
                  <AiAssist
                    kind="list_item_description"
                    context={{ item_title: p.title, section: def.label }}
                    value={p.text}
                    maxChars={220}
                    onApply={(t) => setPairs((x) => x.map((y, k) => (k === i ? { ...y, text: t } : y)))}
                    notesHint="What this item means or covers. Only these facts will be used."
                  />
                )}
              </div>
              {canEdit && <div className="flex gap-1"><Button size="sm" variant="ghost" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp size={14} /></Button><Button size="sm" variant="ghost" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown size={14} /></Button><Button size="sm" variant="ghost" aria-label="Remove" onClick={() => setPairs((x) => x.filter((_, k) => k !== i))}><Trash2 size={14} /></Button></div>}
            </div>
          ))}
          {canEdit && <Button size="sm" variant="secondary" onClick={() => setPairs((x) => [...x, { title: '', text: '' }])}><Plus size={14} /> Add item</Button>}
        </div>
      ) : (
        <>
          <textarea aria-label={def.label} rows={def.kind === 'block' ? 5 : 4} disabled={!canEdit} className={textareaCls} value={text} onChange={(e) => setText(e.target.value)} />
          {canEdit && (
            <AiAssist
              kind={def.kind === 'block' ? 'page_block' : 'page_text'}
              context={{ topic: def.key, section: def.label }}
              value={text}
              onApply={(t) => {
                setText(t);
                if (def.kind === 'block') setBullets(true); // the assistant returns one point per line
              }}
              notesHint={def.hint ?? 'Type the facts this section should cover, even roughly. Only these facts will be used.'}
            />
          )}
          {def.kind === 'block' && <div className="mt-2"><Checkbox label="Show each line as a bullet point" checked={bullets} disabled={!canEdit} onChange={setBullets} /></div>}
        </>
      )}
      {canEdit && <div className="mt-3 flex justify-end"><Button size="sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save section'}</Button></div>}
    </Card>
  );
}

function PagesTab({ canEdit }: { canEdit: boolean }) {
  const [content, setContent] = useState<Record<string, ContentValue> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const load = useCallback(() => { setError(null); loadContent().then((c) => { setContent(c); setVersion((v) => v + 1); }).catch((e) => setError(e.message)); }, []);
  useEffect(load, [load]);
  if (error) return <div className="p-8 text-center text-sm text-red-700" role="alert">{error} <button className="ml-2 underline" onClick={load}>Retry</button></div>;
  if (!content) return <div className="flex justify-center py-12"><Spinner /></div>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Text shown on the public pages. Sections left empty display a clearly marked placeholder on the website.</p>
      {SECTIONS.map((s) => <SectionEditor key={`${s.key}-${version}`} def={s} value={content[s.key]} canEdit={canEdit} onSaved={() => { /* keep local edits */ }} />)}
    </div>
  );
}

/* -------------------------------- Gallery -------------------------------- */

function AlbumForm({ row, onClose, onSaved }: { row: AlbumRow | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: row?.title ?? '', description: row?.description ?? '', event_date: row?.event_date ?? '', status: (row?.status ?? 'DRAFT') as 'DRAFT' | 'PUBLISHED' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photos = useSiteImages('album', row?.id);
  async function submit() {
    if (!f.title.trim()) return setErr('Enter a title.');
    if (f.status === 'PUBLISHED' && photos.images.length === 0) return setErr('Add at least one photograph before publishing.');
    setBusy(true); setErr(null);
    try {
      const id = await saveAlbum(row?.id ?? null, { title: f.title.trim(), description: nz(f.description), event_date: f.event_date || null, status: f.status });
      if (photos.state === 'ready') await replaceSiteImages('album', id, photos.images);
      toast.success(f.status === 'PUBLISHED' ? 'Album saved and published.' : 'Album saved as draft.');
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} title={row ? 'Edit album' : 'Add album'} wide>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Title *" hint="For example: Annual Sports Day 2026."><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={150} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date"><Input type="date" value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></Field>
          <Field label="Status" hint="Only published albums appear on the website."><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as 'DRAFT' | 'PUBLISHED' })}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option></Select></Field>
        </div>
        <Field label="Description (optional)"><textarea rows={3} maxLength={1000} className={textareaCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {photos.state === 'loading' && <div className="flex justify-center py-4"><Spinner /></div>}
        {photos.state === 'ready' && <MultiImageField label="Photographs" folder="gallery" images={photos.images} onChange={photos.setImages} hint="The first photograph is the album cover. Select several files at once; JPG, PNG or WebP, up to 2 MB each." />}
        {photos.state === 'unavailable' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">The photo tables are not set up yet. The administrator needs to run the 0024 database script once.</p>}
        <Err msg={err} />
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={busy || photos.state !== 'ready'} onClick={submit}>{busy ? 'Saving…' : 'Save'}</Button></div>
      </div>
    </Modal>
  );
}

function AlbumsTab({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AlbumRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AlbumRow | 'new' | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const r = await listAlbums(page, PAGE_SIZE); setRows(r.rows); setTotal(r.total); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [page]);
  useEffect(() => { load(); }, [load]);

  async function toggle(a: AlbumRow) {
    try { await saveAlbum(a.id, { title: a.title, description: a.description, event_date: a.event_date, status: a.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }); toast.success(a.status === 'PUBLISHED' ? 'Moved to drafts.' : 'Published.'); load(); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function remove(a: AlbumRow) {
    if (!window.confirm(`Delete the album "${a.title}" and its photographs? This cannot be undone.`)) return;
    try { await deleteAlbum(a.id); toast.success('Album deleted.'); load(); } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <>
      {canEdit && <div className="mb-4 flex justify-end"><Button onClick={() => setEditing('new')}><Plus size={16} /> Add album</Button></div>}
      <Card>
        {error ? <div className="p-8 text-center text-sm text-red-700" role="alert">{error.replace('Please try again.', '')} The photo tables may not be set up yet (run the 0024 database script). <button className="ml-2 underline" onClick={load}>Retry</button></div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Album</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th>{canEdit && <th className="px-4 py-3 text-right">Actions</th>}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (<tr key={a.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-ink-900">{a.title}</td><td className="px-4 py-3 text-slate-600">{a.event_date ? fmt(a.event_date) : '–'}</td><td className="px-4 py-3"><StatusBadge s={a.status} /></td>
                {canEdit && <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(a)}><Pencil size={14} /> Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => toggle(a)}>{a.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${a.title}`} onClick={() => remove(a)}><Trash2 size={14} /></Button></td>}
              </tr>))}
              {loading && !rows.length && <tr><td colSpan={4} className="px-4 py-10 text-center"><Spinner className="mx-auto" /></td></tr>}
              {!loading && !rows.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No albums have been added yet.</td></tr>}
            </tbody></table></div>)}
        <Pager page={page} total={total} onPage={setPage} />
      </Card>
      {editing && <AlbumForm row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </>
  );
}

/* --------------------------------- Page --------------------------------- */

export default function WebsiteContentPage() {
  const { profile } = useAuth();
  const { can, loading } = usePermissions();
  const canEdit = can('manage_content');
  const canView = canEdit || profile?.role === 'PRINCIPAL';
  const [tab, setTab] = useState<'news' | 'events' | 'gallery' | 'programs' | 'pages'>('news');
  const tabs = [['news', 'News'], ['events', 'Events'], ['gallery', 'Gallery'], ['programs', 'Programs'], ['pages', 'Page text']] as const;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink-900">Website Content</h1>
        <p className="text-sm text-slate-500">News, events, gallery, programs and page text shown on the public college website.</p>
      </div>
      {loading ? <div className="flex justify-center py-16"><Spinner /></div> : !canView ? <NoAccess /> : (
        <>
          {!canEdit && <ReadOnlyNote />}
          <div className="mb-5 flex gap-6 border-b border-slate-200" role="tablist">
            {tabs.map(([k, l]) => (<button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-1 pb-3 text-sm font-semibold ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{l}</button>))}
          </div>
          {tab === 'news' && <NewsTab canEdit={canEdit} />}
          {tab === 'events' && <EventsTab canEdit={canEdit} />}
          {tab === 'gallery' && <AlbumsTab canEdit={canEdit} />}
          {tab === 'programs' && <ProgramsTab canEdit={canEdit} />}
          {tab === 'pages' && <PagesTab canEdit={canEdit} />}
        </>
      )}
    </DashboardLayout>
  );
}
