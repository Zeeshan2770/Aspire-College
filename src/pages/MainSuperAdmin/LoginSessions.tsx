import { useEffect, useMemo, useState } from 'react';
import { LogIn, UserPlus, Mail, KeyRound as KeyIcon } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, Badge, Input, Label, Select } from '@/components/ui';
import { listLoginSessions } from '@/services/crAccounts';
import { LoginSession } from '@/types';

const EVENT_META: Record<string, { label: string; tone: 'blue' | 'green' | 'amber' | 'red'; icon: JSX.Element }> = {
  LOGIN: { label: 'Logged In', tone: 'blue', icon: <LogIn size={13} /> },
  ACCOUNT_CREATED: { label: 'Account Created', tone: 'green', icon: <UserPlus size={13} /> },
  EMAIL_CHANGED: { label: 'Email Changed', tone: 'amber', icon: <Mail size={13} /> },
  PASSWORD_CHANGED: { label: 'Password Changed', tone: 'red', icon: <KeyIcon size={13} /> },
};

export default function LoginSessionsPage() {
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    listLoginSessions({ limit: 500 }).then((d) => setSessions(d as LoginSession[])).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => sessions.filter((s) => {
    if (eventFilter && s.event_type !== eventFilter) return false;
    if (search && !`${s.user_name} ${s.performed_by_name ?? ''} ${s.description}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [sessions, eventFilter, search]);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Login Sessions</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">See who logged in, and who changed whose email or password.</p>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Search</Label><Input placeholder="Search by name or detail…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div>
            <Label>Event Type</Label>
            <Select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="">All events</option>
              <option value="LOGIN">Logged In</option>
              <option value="ACCOUNT_CREATED">Account Created</option>
              <option value="EMAIL_CHANGED">Email Changed</option>
              <option value="PASSWORD_CHANGED">Password Changed</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-[#F4F7FC] text-left text-xs font-semibold tracking-wide text-[#5B6B83]">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Detail</th>
              <th className="px-4 py-3">Performed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((s) => {
              const meta = EVENT_META[s.event_type] ?? { label: s.event_type, tone: 'blue' as const, icon: null };
              return (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{s.user_name} <span className="text-slate-500">({s.user_role})</span></td>
                  <td className="px-4 py-3"><Badge tone={meta.tone}><span className="mr-1 inline-flex align-middle">{meta.icon}</span>{meta.label}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{s.description}</td>
                  <td className="px-4 py-3 text-slate-500">{s.performed_by_name ?? (s.event_type === 'LOGIN' ? 'Self' : '—')}</td>
                </tr>
              );
            })}
            {!loading && !filtered.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No session activity recorded yet.</td></tr>}
          </tbody>
        </table></div>
      </Card>
    </DashboardLayout>
  );
}
