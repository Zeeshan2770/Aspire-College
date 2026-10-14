import { useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Card, Input, Label, Select } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { CollegeReportFormat, admissionsReport, facultyReport } from '@/services/reports/collegeReports';

/** Admissions and Faculty reports, shown only to roles that may read that data. */
export default function CollegeReports() {
  const { profile } = useAuth();
  const { can } = usePermissions();
  const canAdmissions = can('manage_admissions') || profile?.role === 'PRINCIPAL';
  const canFaculty = profile?.role === 'MAIN_SUPER_ADMIN' || profile?.role === 'PRINCIPAL' || profile?.role === 'SUB_SUPER_ADMIN';

  const [aStatus, setAStatus] = useState('');
  const [aFrom, setAFrom] = useState('');
  const [aTo, setATo] = useState('');
  const [fStatus, setFStatus] = useState('ACTIVE');
  const [busy, setBusy] = useState<string | null>(null);

  if (!canAdmissions && !canFaculty) return null;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      toast.success('Report downloaded.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const fmtBtns = (key: string, go: (f: CollegeReportFormat) => Promise<void>) => (
    <div className="mt-5 flex flex-wrap gap-3">
      <Button disabled={busy !== null} onClick={() => run(`${key}-pdf`, () => go('pdf'))}><FileDown size={16} /> {busy === `${key}-pdf` ? 'Preparing…' : 'Download PDF'}</Button>
      <Button disabled={busy !== null} variant="secondary" onClick={() => run(`${key}-csv`, () => go('csv'))}><FileSpreadsheet size={16} /> {busy === `${key}-csv` ? 'Preparing…' : 'Download CSV'}</Button>
    </div>
  );

  return (
    <section className="mt-8" aria-label="College reports">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">College reports</h2>
      <div className="grid gap-5 lg:grid-cols-2">
        {canAdmissions && (
          <Card className="p-6">
            <h3 className="font-display font-bold text-ink-900">Admission applications</h3>
            <p className="text-xs text-slate-500">Applications submitted through the website.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div><Label>Status</Label>
                <Select value={aStatus} onChange={(e) => setAStatus(e.target.value)}>
                  <option value="">All</option><option value="SUBMITTED">Submitted</option><option value="UNDER_REVIEW">Under Review</option><option value="ACCEPTED">Accepted</option><option value="REJECTED">Rejected</option>
                </Select></div>
              <div><Label>From</Label><Input type="date" value={aFrom} onChange={(e) => setAFrom(e.target.value)} /></div>
              <div><Label>To</Label><Input type="date" value={aTo} onChange={(e) => setATo(e.target.value)} /></div>
            </div>
            {fmtBtns('adm', (format) => admissionsReport({ status: aStatus, from: aFrom, to: aTo, format }))}
          </Card>
        )}
        {canFaculty && (
          <Card className="p-6">
            <h3 className="font-display font-bold text-ink-900">Faculty list</h3>
            <p className="text-xs text-slate-500">Includes internal contact details. Do not publish.</p>
            <div className="mt-4 max-w-xs">
              <Label>Status</Label>
              <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="">All</option>
              </Select>
            </div>
            {fmtBtns('fac', (format) => facultyReport({ status: fStatus, format }))}
          </Card>
        )}
      </div>
    </section>
  );
}
