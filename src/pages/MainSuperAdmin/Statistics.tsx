import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, Select, Badge } from '@/components/ui';
import {
  getAttendanceTrend, getSectionComparison, getTopAbsentees, getConcernBreakdown,
  DayPoint, SectionStat, AbsenteeStat, ConcernBreakdown,
} from '@/services/statistics';

const RANGE_OPTIONS = [
  { value: 7, label: 'Last 7 days' },
  { value: 14, label: 'Last 14 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

const CONCERN_COLORS: Record<string, string> = {
  SUBMITTED: '#f59e0b',
  UNDER_REVIEW: '#3b82f6',
  RESOLVED: '#10b981',
  CLOSED: '#94a3b8',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function StatisticsPage() {
  const [range, setRange] = useState(14);
  const [trend, setTrend] = useState<DayPoint[]>([]);
  const [sections, setSections] = useState<SectionStat[]>([]);
  const [absentees, setAbsentees] = useState<AbsenteeStat[]>([]);
  const [concerns, setConcerns] = useState<ConcernBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAttendanceTrend(range),
      getSectionComparison(range),
      getTopAbsentees(10, range),
      getConcernBreakdown(range),
    ]).then(([t, s, a, c]) => {
      setTrend(t);
      setSections(s);
      setAbsentees(a);
      setConcerns(c);
      setLoading(false);
    });
  }, [range]);

  const avgAttendance = trend.length
    ? Math.round((trend.reduce((sum, d) => sum + d.percentage, 0) / trend.filter((d) => d.total > 0).length || 0) * 10) / 10
    : 0;

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-ink-900 sm:text-2xl">Advanced Statistics</h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">Trends and comparisons across the whole system.</p>
        </div>
        <Select className="w-44" value={range} onChange={(e) => setRange(Number(e.target.value))}>
          {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-slate-500">Crunching the numbers…</Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-1 flex items-center gap-2">
              <TrendingUp size={16} className="text-brand-600" />
              <h3 className="font-display font-bold text-ink-900">Attendance Trend</h3>
              {trend.some((d) => d.total > 0) && (
                <Badge tone={avgAttendance >= 75 ? 'green' : avgAttendance >= 50 ? 'amber' : 'red'}>
                  {avgAttendance}% avg present
                </Badge>
              )}
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="%" domain={[0, 100]} />
                  <Tooltip labelFormatter={(d) => formatDate(d as string)} formatter={(v: number) => [`${v}%`, 'Present']} />
                  <Line type="monotone" dataKey="percentage" stroke="#4f6bf0" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <h3 className="mb-3 font-bold text-ink-900">Attendance by Section</h3>
              {sections.length ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sections} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis
                        type="category"
                        dataKey="sectionName"
                        width={110}
                        tick={{ fontSize: 11, fill: '#334155' }}
                        tickFormatter={(_, i) => `${sections[i]?.className} - ${sections[i]?.sectionName}`}
                      />
                      <Tooltip formatter={(v: number) => [`${v}%`, 'Present']} />
                      <Bar dataKey="percentage" fill="#4f6bf0" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">No attendance data for this period.</p>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 font-bold text-ink-900">Concerns Breakdown</h3>
              {concerns.length ? (
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={concerns} dataKey="count" nameKey="status" cx="50%" cy="45%" outerRadius={80} label={(d: any) => d.count}>
                        {concerns.map((c) => <Cell key={c.status} fill={CONCERN_COLORS[c.status] ?? '#94a3b8'} />)}
                      </Pie>
                      <Legend formatter={(v) => v.replace(/_/g, ' ')} wrapperStyle={{ fontSize: 12 }} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-slate-500">No concerns reported in this period.</p>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="font-display font-bold text-ink-900">Students Needing Attention</h3>
              <span className="text-xs text-slate-500">(lowest attendance, min. 3 recorded days)</span>
            </div>
            <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-[#F4F7FC] text-left text-xs font-semibold tracking-wide text-[#5B6B83]">
                <tr>
                  <th className="px-5 py-2.5">Student</th>
                  <th className="px-5 py-2.5">Class / Section</th>
                  <th className="px-5 py-2.5">Present / Total</th>
                  <th className="px-5 py-2.5">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {absentees.map((a) => (
                  <tr key={a.studentId}>
                    <td className="px-5 py-2.5 font-medium text-ink-900">{a.fullName} <span className="text-slate-500">#{a.rollNumber}</span></td>
                    <td className="px-5 py-2.5 text-slate-500">{a.className} — {a.sectionName}</td>
                    <td className="px-5 py-2.5 text-slate-500">{a.present} / {a.total}</td>
                    <td className="px-5 py-2.5"><Badge tone={a.percentage >= 50 ? 'amber' : 'red'}>{a.percentage}%</Badge></td>
                  </tr>
                ))}
                {!absentees.length && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">No data for this period.</td></tr>
                )}
              </tbody>
            </table></div>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
