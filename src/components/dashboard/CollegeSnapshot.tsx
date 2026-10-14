import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Inbox, UserSquare2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, StatCard } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface LogRow {
  id: string;
  admin_name: string;
  action: string;
  target: string | null;
  description: string;
  created_at: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * College-level numbers (faculty, admissions, inquiries) and recent activity.
 * Every figure comes from the database and is shown only if the signed-in
 * role is allowed to read it.
 */
export default function CollegeSnapshot() {
  const { profile } = useAuth();
  const { can } = usePermissions();
  const role = profile?.role;
  const canAdmissions = can('manage_admissions') || role === 'PRINCIPAL';
  const canLogs = role === 'MAIN_SUPER_ADMIN';

  const [faculty, setFaculty] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!role) return;
    let alive = true;
    (async () => {
      try {
        const [f, p, u, l] = await Promise.all([
          supabase.from('faculty').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
          canAdmissions
            ? supabase.from('admissions').select('id', { count: 'exact', head: true }).in('status', ['SUBMITTED', 'UNDER_REVIEW'])
            : Promise.resolve({ count: null, error: null }),
          canAdmissions
            ? supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('is_read', false)
            : Promise.resolve({ count: null, error: null }),
          canLogs
            ? supabase.from('admin_activity_logs').select('id, admin_name, action, target, description, created_at').order('created_at', { ascending: false }).limit(8)
            : Promise.resolve({ data: null, error: null }),
        ]);
        if (!alive) return;
        if (f.error || p.error || u.error || l.error) setFailed(true);
        setFaculty(f.count ?? 0);
        setPending(p.count);
        setUnread(u.count);
        setLogs((l.data as LogRow[] | null) ?? null);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [role, canAdmissions, canLogs]);

  if (failed) {
    return (
      <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Unable to load the college overview. Please refresh the page.
      </div>
    );
  }

  return (
    <section className="mt-8" aria-label="College overview">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">College overview</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Link to="/admin/faculty" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          <StatCard label="Active Faculty" value={faculty ?? '–'} icon={<UserSquare2 size={20} />} />
        </Link>
        {canAdmissions && (
          <>
            <Link to="/admin/admissions" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <StatCard label="Pending Admissions" value={pending ?? '–'} icon={<FileText size={20} />} tone="amber" />
            </Link>
            <Link to="/admin/admissions" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <StatCard label="Unread Inquiries" value={unread ?? '–'} icon={<Inbox size={20} />} tone="amber" />
            </Link>
          </>
        )}
      </div>

      {canLogs && (
        <Card className="mt-6">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h3 className="font-display font-semibold text-ink-900">Recent activity</h3>
            <Link to="/admin/logs" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>
          </div>
          {logs === null ? (
            <p className="px-5 py-6 text-sm text-slate-500">Loading…</p>
          ) : !logs.length ? (
            <p className="px-5 py-6 text-sm text-slate-500">No activity has been recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {logs.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium text-ink-900">{l.action}</span>
                    {l.target && <span className="text-slate-500"> · {l.target}</span>}
                    <span className="block text-xs text-slate-500">{l.admin_name}</span>
                  </span>
                  <span className="text-xs text-slate-500">{when(l.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </section>
  );
}
