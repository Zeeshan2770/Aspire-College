import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { fetchActivityLogs } from '@/services/activityLog';
import { AdminActivityLog } from '@/types';

export default function ActivityLogsPage() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);

  useEffect(() => {
    if (!profile) return;
    fetchActivityLogs({ onlyOwn: false, adminId: profile.id, limit: 200 }).then(setLogs as any);
  }, [profile]);

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Administrative Activity Logs</h1>
        <p className="mt-1 text-sm text-[var(--text-2)]">
          Every action taken by any admin account. Visible only to the Main Super Admin.
        </p>
      </div>

      <Card className="divide-y divide-slate-100">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink-900">{log.admin_name}</span>
                <Badge tone={log.admin_role === 'MAIN_SUPER_ADMIN' ? 'blue' : 'amber'}>{log.admin_role.replace(/_/g, ' ')}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{log.description}</p>
            </div>
            <div className="whitespace-nowrap text-right text-xs text-slate-500">
              <div>{new Date(log.created_at).toLocaleDateString()}</div>
              <div>{new Date(log.created_at).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
        {!logs.length && <div className="px-5 py-10 text-center text-slate-500">No activity recorded yet.</div>}
      </Card>
    </DashboardLayout>
  );
}
