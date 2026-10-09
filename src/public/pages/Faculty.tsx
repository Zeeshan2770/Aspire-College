import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { fetchFaculty } from '../api';
import { useAsync } from '../useAsync';
import { PageHeader, Photo, Section, StateBox } from '../components';

const PAGE = 12;
const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.map((x) => x?.trim()).filter(Boolean) as string[])).sort();

export default function Faculty() {
  const { data, loading, error, retry } = useAsync(fetchFaculty);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [subject, setSubject] = useState('');
  const [desig, setDesig] = useState('');
  const [shown, setShown] = useState(PAGE);

  const all = data ?? [];
  const depts = useMemo(() => uniq(all.map((f) => f.department)), [all]);
  const subjects = useMemo(() => uniq(all.map((f) => f.subject)), [all]);
  const desigs = useMemo(() => uniq(all.map((f) => f.designation)), [all]);
  const filtered = useMemo(
    () =>
      all.filter(
        (f) =>
          (!dept || f.department === dept) &&
          (!subject || f.subject === subject) &&
          (!desig || f.designation === desig) &&
          (!q.trim() || f.full_name.toLowerCase().includes(q.trim().toLowerCase()))
      ),
    [all, q, dept, subject, desig]
  );

  const sel = 'w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm focus:border-college-primary focus:outline-none focus:ring-1 focus:ring-college-primary';
  const reset = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { fn(e.target.value); setShown(PAGE); };

  return (
    <>
      <PageHeader title="Faculty" subtitle="Our teaching staff." />
      <Section>
        {loading ? <StateBox kind="loading" /> : error ? <StateBox kind="error" message={error} onRetry={retry} /> : !all.length ? (
          <StateBox kind="empty" message="Faculty profiles will be published here once they have been added." />
        ) : (
          <>
            <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <label htmlFor="fq" className="sr-only">Search by name</label>
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
                <input id="fq" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search by name" className={`${sel} pl-9`} />
              </div>
              <div><label htmlFor="fd" className="sr-only">Department</label><select id="fd" value={dept} onChange={reset(setDept)} className={sel}><option value="">All departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</select></div>
              <div><label htmlFor="fs" className="sr-only">Subject</label><select id="fs" value={subject} onChange={reset(setSubject)} className={sel}><option value="">All subjects</option>{subjects.map((d) => <option key={d}>{d}</option>)}</select></div>
              <div><label htmlFor="fg" className="sr-only">Designation</label><select id="fg" value={desig} onChange={reset(setDesig)} className={sel}><option value="">All designations</option>{desigs.map((d) => <option key={d}>{d}</option>)}</select></div>
            </div>

            {!filtered.length ? (
              <StateBox kind="empty" message="No faculty members match your filters." />
            ) : (
              <>
                <p className="mb-4 text-sm text-slate-500" aria-live="polite">{filtered.length} faculty member{filtered.length === 1 ? '' : 's'}</p>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.slice(0, shown).map((f) => (
                    <article key={f.id} className="flex gap-4 rounded border border-slate-200 p-4">
                      <Photo src={f.photo_url} alt={f.full_name} className="h-24 w-20 shrink-0 rounded" label="Photo" />
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-semibold text-college-primary">{f.full_name}</h3>
                        {f.designation && <p className="text-sm text-slate-700">{f.designation}</p>}
                        {(f.department || f.subject) && <p className="text-sm text-slate-500">{[f.department, f.subject].filter(Boolean).join(' · ')}</p>}
                        {f.qualification && <p className="mt-1 text-xs text-slate-500">{f.qualification}</p>}
                        {f.bio && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{f.bio}</p>}
                      </div>
                    </article>
                  ))}
                </div>
                {shown < filtered.length && (
                  <div className="mt-8 text-center">
                    <button onClick={() => setShown((s) => s + PAGE)} className="rounded border border-college-primary px-5 py-2 text-sm font-semibold text-college-primary hover:bg-college-primary/5">Show more</button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Section>
    </>
  );
}
