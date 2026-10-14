import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Users,
  X,
  FileWarning,
  ArrowRightLeft,
  Sparkles,
  Check,
  Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Badge } from '@/components/ui';
import { ClassRow, SectionRow } from '@/types';
import { parseStudentCsv } from '@/services/csv';
import { bulkCreateStudentLoginsForRollNumbers } from '@/services/studentAccounts';
import { requestAiFixes, suggestionHasChanges, RowSuggestion } from '@/services/aiCsvAssist';
import {
  buildImportPlan,
  reanalyzePlan,
  applyImportPlan,
  downloadImportReport,
  ImportPlan,
  PlanRow,
  RowStatus,
  ApplyImportResult,
} from '@/services/smartImport';

type Stage = 'analyzing' | 'review' | 'confirm' | 'importing' | 'complete';
type Tab = 'all' | 'new' | 'existing' | 'updates' | 'moved' | 'duplicates' | 'warnings' | 'errors';

const TAB_STATUS: Record<Exclude<Tab, 'all'>, RowStatus[]> = {
  new: ['NEW'],
  existing: ['EXISTING'],
  updates: ['UPDATE'],
  moved: ['MOVED'],
  duplicates: ['DUPLICATE'],
  warnings: ['CONFLICT'],
  errors: ['ERROR'],
};

const STATUS_BADGE: Record<RowStatus, { tone: 'green' | 'blue' | 'amber' | 'red' | 'slate'; label: string }> = {
  NEW: { tone: 'green', label: 'New' },
  EXISTING: { tone: 'blue', label: 'Existing' },
  UPDATE: { tone: 'blue', label: 'Update' },
  MOVED: { tone: 'amber', label: 'Movement' },
  DUPLICATE: { tone: 'amber', label: 'Duplicate' },
  CONFLICT: { tone: 'red', label: 'Conflict' },
  ERROR: { tone: 'red', label: 'Error' },
};

export function SmartImportWizard({
  file,
  open,
  onClose,
  classes,
  sections,
  adminName,
  onComplete,
}: {
  file: File | null;
  open: boolean;
  onClose: () => void;
  classes: ClassRow[];
  sections: SectionRow[];
  adminName: string;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<Stage>('analyzing');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [confirmedMoves, setConfirmedMoves] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ApplyImportResult | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [createLogins, setCreateLogins] = useState(false);
  const [loginSummary, setLoginSummary] = useState<{ created: number; skipped: number; failed: number } | null>(null);
  const [creatingLogins, setCreatingLogins] = useState(false);

  // Live find-and-fix: inline edits re-run the same analysis engine that
  // ran at upload time, so a row's status/badge updates the moment it's
  // fixed — no re-upload needed.
  const [reanalyzing, setReanalyzing] = useState(false);
  const analyzeTokenRef = useRef(0);

  // Optional AI Assist for rows the deterministic engine + fuzzy matching
  // still couldn't resolve on their own.
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Record<number, RowSuggestion>>({});

  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;
    setStage('analyzing');
    setPlan(null);
    setResult(null);
    setFatalError(null);
    setTab('all');
    setUpdateExisting(false);
    setConfirmedMoves(new Set());
    setCreateLogins(false);
    setLoginSummary(null);
    setAiSuggestions({});

    (async () => {
      try {
        const parsed = await parseStudentCsv(file);
        const headerWarnings = [
          ...parsed.warnings,
          ...(parsed.missingHeaders.length
            ? [`No column found for: ${parsed.missingHeaders.join(', ')}. Rows are missing this data.`]
            : []),
        ];
        const builtPlan = await buildImportPlan(parsed.rows, classes, sections, headerWarnings);
        if (cancelled) return;
        setPlan(builtPlan);
        setStage('review');
      } catch (e: any) {
        if (cancelled) return;
        setFatalError(e.message ?? 'Could not read this CSV file.');
        setStage('review');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file]);

  const includedCount = useMemo(() => {
    if (!plan) return 0;
    let n = 0;
    for (const r of plan.rows) {
      if (r.status === 'NEW') n++;
      else if (r.status === 'UPDATE' && updateExisting) n++;
      else if (r.status === 'MOVED' && confirmedMoves.has(r.csvRowNumber)) n++;
    }
    return n;
  }, [plan, updateExisting, confirmedMoves]);

  const newClassCount = useMemo(() => (plan ? plan.structure.filter((c) => !c.existing).length : 0), [plan]);
  const newSectionCount = useMemo(
    () => (plan ? plan.structure.reduce((sum, c) => sum + c.sections.filter((s) => !s.existing).length, 0) : 0),
    [plan]
  );

  const filteredRows = useMemo(() => {
    if (!plan) return [];
    if (tab === 'all') return plan.rows;
    const statuses = TAB_STATUS[tab];
    return plan.rows.filter((r) => statuses.includes(r.status));
  }, [plan, tab]);

  function toggleMove(rowNumber: number) {
    setConfirmedMoves((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function confirmAllMoves() {
    if (!plan) return;
    setConfirmedMoves(new Set(plan.rows.filter((r) => r.status === 'MOVED').map((r) => r.csvRowNumber)));
  }

  /** Updates a field on one row immediately (so typing feels responsive) without re-classifying yet — that happens on blur via reanalyze(). */
  function editField(rowNumber: number, field: 'name' | 'fatherName' | 'rollNumber' | 'className' | 'sectionName', value: string) {
    setPlan((prev) => prev ? { ...prev, rows: prev.rows.map((r) => (r.csvRowNumber === rowNumber ? { ...r, [field]: value } : r)) } : prev);
  }

  /** Re-runs the full analysis against the current (possibly hand-edited) rows. Stale responses are dropped via a token so rapid edits can't race each other. */
  async function reanalyze(rows: PlanRow[]) {
    if (!plan) return;
    const token = ++analyzeTokenRef.current;
    setReanalyzing(true);
    try {
      const fresh = await reanalyzePlan(rows, classes, sections, plan.headerWarnings);
      if (analyzeTokenRef.current !== token) return; // a newer edit already superseded this
      setPlan(fresh);
      setConfirmedMoves((prev) => new Set(Array.from(prev).filter((n) => fresh.rows.some((r) => r.csvRowNumber === n && r.status === 'MOVED'))));
    } catch (e: any) {
      toast.error(e.message ?? 'Could not re-check that row.');
    } finally {
      if (analyzeTokenRef.current === token) setReanalyzing(false);
    }
  }

  function applyClassSuggestion(row: PlanRow) {
    if (!row.classSuggestion || !plan) return;
    const updated = plan.rows.map((r) => (r.csvRowNumber === row.csvRowNumber ? { ...r, className: row.classSuggestion! } : r));
    reanalyze(updated);
  }

  function applySectionSuggestion(row: PlanRow) {
    if (!row.sectionSuggestion || !plan) return;
    const updated = plan.rows.map((r) => (r.csvRowNumber === row.csvRowNumber ? { ...r, sectionName: row.sectionSuggestion! } : r));
    reanalyze(updated);
  }

  const unresolvedRows = useMemo(
    () => (plan ? plan.rows.filter((r) => r.status === 'ERROR' || r.status === 'CONFLICT' || r.status === 'DUPLICATE') : []),
    [plan]
  );

  async function runAiAssist() {
    if (!plan || !unresolvedRows.length) return;
    setAiLoading(true);
    try {
      const suggestions = await requestAiFixes(unresolvedRows, classes, sections);
      if (!suggestions.length) {
        toast('AI Assist didn\u2019t find any confident fixes for these rows.', { icon: '\u2139\ufe0f' });
      }
      setAiSuggestions((prev) => {
        const next = { ...prev };
        for (const s of suggestions) next[s.csvRowNumber] = s;
        return next;
      });
    } catch (e: any) {
      toast.error(e.message ?? 'AI Assist failed.');
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiSuggestion(row: PlanRow) {
    const s = aiSuggestions[row.csvRowNumber];
    if (!s || !plan) return;
    const updated = plan.rows.map((r) => {
      if (r.csvRowNumber !== row.csvRowNumber) return r;
      return {
        ...r,
        name: s.name?.trim() || r.name,
        fatherName: s.fatherName?.trim() || r.fatherName,
        rollNumber: s.rollNumber?.trim() || r.rollNumber,
        className: s.className?.trim() || r.className,
        sectionName: s.sectionName?.trim() || r.sectionName,
        phone: s.phone?.trim() || r.phone,
      };
    });
    setAiSuggestions((prev) => {
      const next = { ...prev };
      delete next[row.csvRowNumber];
      return next;
    });
    reanalyze(updated);
  }

  function dismissAiSuggestion(rowNumber: number) {
    setAiSuggestions((prev) => {
      const next = { ...prev };
      delete next[rowNumber];
      return next;
    });
  }

  async function runImport() {
    if (!plan) return;
    setStage('importing');
    setImporting(true);
    try {
      const res = await applyImportPlan(plan, {
        updateExisting,
        confirmedMovementRowNumbers: confirmedMoves,
        filename: file?.name ?? 'upload.csv',
      });
      setResult(res);
      setStage('complete');
      onComplete();

      // Best-effort, runs only after the import itself has fully
      // committed — see bulkCreateStudentLoginsForRollNumbers for why
      // this is deliberately a separate step rather than part of the
      // atomic import transaction.
      if (createLogins) {
        setCreatingLogins(true);
        const includedRows = plan.rows.filter(
          (r) => r.status === 'NEW' || (r.status === 'UPDATE' && updateExisting) || (r.status === 'MOVED' && confirmedMoves.has(r.csvRowNumber))
        );
        try {
          const summary = await bulkCreateStudentLoginsForRollNumbers(
            includedRows.map((r) => ({ rollNumber: r.rollNumber, className: r.className, sectionName: r.sectionName }))
          );
          setLoginSummary(summary);
        } catch (e: any) {
          toast.error(e.message ?? 'Student import succeeded, but creating logins failed.');
        } finally {
          setCreatingLogins(false);
        }
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Import failed.');
      setStage('review');
    } finally {
      setImporting(false);
    }
  }

  if (!open) return null;

  const movedCount = plan?.counts.moved ?? 0;
  const unconfirmedMoves = movedCount - confirmedMoves.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">Smart CSV Import</h3>
            <p className="text-xs text-slate-500">{file?.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {stage === 'analyzing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
              <Loader2 size={28} className="animate-spin text-brand-600" />
              <p className="text-sm font-medium">Analyzing CSV…</p>
              <p className="text-xs text-slate-500">Detecting academic structure and matching existing students.</p>
            </div>
          )}

          {fatalError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{fatalError}</span>
            </div>
          )}

          {stage === 'review' && plan && (
            <>
              {/* Stats */}
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                <Stat label="Total Rows" value={plan.counts.total} tone="slate" />
                <Stat label="New" value={plan.counts.new} tone="green" />
                <Stat label="Existing" value={plan.counts.existing} tone="blue" />
                <Stat label="Updates" value={plan.counts.updates} tone="blue" />
                <Stat label="Movements" value={plan.counts.moved} tone="amber" />
                <Stat label="Duplicates" value={plan.counts.duplicates} tone="amber" />
                <Stat label="Warnings/Errors" value={plan.counts.conflicts + plan.counts.errors} tone="red" />
              </div>

              {plan.headerWarnings.length > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
                  <FileWarning size={15} className="mt-0.5 shrink-0" />
                  <span>{plan.headerWarnings.join(' ')}</span>
                </div>
              )}

              {/* Academic structure preview */}
              {plan.structure.length > 0 && (
                <div className="mb-4 rounded-xl border border-slate-200 p-3.5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Academic Structure
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {plan.structure.map((c) => (
                      <div key={c.name} className="text-sm">
                        <div className="flex items-center gap-2 font-semibold text-ink-800">
                          {c.name}
                          {!c.existing && <Badge tone="green">+ New</Badge>}
                        </div>
                        <ul className="ml-4 mt-1 space-y-0.5">
                          {c.sections.map((s) => (
                            <li key={s.name} className="flex items-center gap-2 text-xs text-slate-600">
                              <span>└ {s.name}</span>
                              {s.existing ? (
                                <span className="text-emerald-600">✓ Existing</span>
                              ) : (
                                <span className="font-medium text-brand-600">+ New</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 px-3.5 py-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    disabled={plan.counts.updates === 0}
                  />
                  Update {plan.counts.updates} existing student{plan.counts.updates === 1 ? '' : 's'} whose details
                  changed
                </label>
                {movedCount > 0 && (
                  <Button size="sm" variant="secondary" onClick={confirmAllMoves}>
                    <ArrowRightLeft size={14} /> Confirm all {movedCount} movement{movedCount === 1 ? '' : 's'}
                  </Button>
                )}
              </div>

              {/* Tabs */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['all', 'All', plan.counts.total],
                      ['new', 'New', plan.counts.new],
                      ['existing', 'Existing', plan.counts.existing],
                      ['updates', 'Updates', plan.counts.updates],
                      ['moved', 'Movements', plan.counts.moved],
                      ['duplicates', 'Duplicates', plan.counts.duplicates],
                      ['warnings', 'Warnings', plan.counts.conflicts],
                      ['errors', 'Errors', plan.counts.errors],
                    ] as [Tab, string, number][]
                  ).map(([key, label, count]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        tab === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {reanalyzing && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Loader2 size={13} className="animate-spin" /> Re-checking…
                    </span>
                  )}
                  {unresolvedRows.length > 0 && (
                    <Button size="sm" variant="secondary" onClick={runAiAssist} disabled={aiLoading}>
                      {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {aiLoading ? 'Thinking…' : `AI Assist (${unresolvedRows.length})`}
                    </Button>
                  )}
                </div>
              </div>

              <p className="mb-2 text-xs text-slate-500">
                Name, Roll #, Class, and Section are editable directly in the table below — fix a row and it re-checks itself instantly.
              </p>

              {/* Row table */}
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#F4F7FC] text-left text-[#5B6B83]">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Roll #</th>
                      <th className="px-3 py-2">Class / Section</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((r) => (
                      <RowLine
                        key={r.csvRowNumber}
                        row={r}
                        confirmed={confirmedMoves.has(r.csvRowNumber)}
                        onToggleMove={toggleMove}
                        onEditField={editField}
                        onBlurField={() => plan && reanalyze(plan.rows)}
                        onApplyClassSuggestion={applyClassSuggestion}
                        onApplySectionSuggestion={applySectionSuggestion}
                        aiSuggestion={aiSuggestions[r.csvRowNumber]}
                        onApplyAiSuggestion={applyAiSuggestion}
                        onDismissAiSuggestion={dismissAiSuggestion}
                      />
                    ))}
                    {!filteredRows.length && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                          No rows in this view.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {stage === 'importing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
              <Loader2 size={28} className="animate-spin text-brand-600" />
              <p className="text-sm font-medium">Importing students…</p>
              <p className="text-xs text-slate-500">Creating structure and writing records in one transaction.</p>
            </div>
          )}

          {stage === 'complete' && result && (
            <div className="py-4">
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-emerald-800">
                <CheckCircle2 size={22} />
                <div>
                  <p className="font-bold">Import Complete</p>
                  <p className="text-xs text-emerald-700">{result.totalRows} CSV rows processed</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="New Students" value={result.studentsCreated} tone="green" />
                <Stat label="Updated" value={result.studentsUpdated} tone="blue" />
                <Stat label="Movements" value={result.studentsMoved} tone="amber" />
                <Stat label="Skipped" value={result.studentsSkipped} tone="slate" />
                <Stat label="Classes Created" value={result.classesCreated.length} tone="green" />
                <Stat label="Sections Created" value={result.sectionsCreated.length} tone="green" />
              </div>

              {createLogins && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  {creatingLogins ? (
                    <p className="flex items-center gap-2 text-slate-500"><Loader2 size={14} className="animate-spin" /> Creating student logins…</p>
                  ) : loginSummary ? (
                    <p className="text-slate-600">
                      Student logins: <strong className="text-emerald-700">{loginSummary.created} created</strong>,{' '}
                      <strong className="text-slate-500">{loginSummary.skipped} already had an account</strong>
                      {loginSummary.failed > 0 && <>, <strong className="text-red-600">{loginSummary.failed} could not be matched</strong></>}.
                      {' '}Find them under Student Accounts.
                    </p>
                  ) : null}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadImportReport(result, { filename: file?.name ?? 'upload.csv', performedBy: adminName })
                  }
                >
                  <Download size={15} /> Download Import Report
                </Button>
                <Button onClick={onClose}>
                  <Users size={15} /> View Students
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {stage === 'review' && plan && (
          <div className="border-t border-slate-100 px-6 py-4">
            {unconfirmedMoves > 0 && (
              <p className="mb-2 text-xs text-amber-700">
                {unconfirmedMoves} possible movement{unconfirmedMoves === 1 ? '' : 's'} not yet confirmed — those rows
                will be skipped.
              </p>
            )}
            <label className="mb-3 flex items-center gap-2 text-sm text-ink-800">
              <input type="checkbox" checked={createLogins} onChange={(e) => setCreateLogins(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Create Student Login for imported students (skips anyone who already has an account)
            </label>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                This will create {newClassCount} class{newClassCount === 1 ? '' : 'es'}, {newSectionCount} section
                {newSectionCount === 1 ? '' : 's'}, and add {includedCount} student record
                {includedCount === 1 ? '' : 's'}.
              </p>
              <Button disabled={!includedCount || importing} onClick={runImport}>
                {newClassCount || newSectionCount ? 'Create Structure & Import Students' : 'Import Students'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'slate' | 'green' | 'blue' | 'amber' | 'red' }) {
  const tones = {
    slate: 'bg-slate-50 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl px-3 py-2.5 ${tones[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-extrabold">{value}</p>
    </div>
  );
}

function RowLine({
  row,
  confirmed,
  onToggleMove,
  onEditField,
  onBlurField,
  onApplyClassSuggestion,
  onApplySectionSuggestion,
  aiSuggestion,
  onApplyAiSuggestion,
  onDismissAiSuggestion,
}: {
  row: PlanRow;
  confirmed: boolean;
  onToggleMove: (rowNumber: number) => void;
  onEditField: (rowNumber: number, field: 'name' | 'fatherName' | 'rollNumber' | 'className' | 'sectionName', value: string) => void;
  onBlurField: () => void;
  onApplyClassSuggestion: (row: PlanRow) => void;
  onApplySectionSuggestion: (row: PlanRow) => void;
  aiSuggestion?: RowSuggestion;
  onApplyAiSuggestion: (row: PlanRow) => void;
  onDismissAiSuggestion: (rowNumber: number) => void;
}) {
  const badge = STATUS_BADGE[row.status];
  const needsFix = row.status === 'ERROR' || row.status === 'CONFLICT' || row.status === 'DUPLICATE';
  const cellInputClass =
    'w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 hover:border-slate-200';

  return (
    <tr className={row.status === 'ERROR' || row.status === 'CONFLICT' ? 'bg-red-50/50' : ''}>
      <td className="px-3 py-2 align-top text-slate-500">{row.csvRowNumber}</td>
      <td className="px-1 py-1.5 align-top">
        <input
          className={cellInputClass}
          value={row.name}
          placeholder="Name"
          onChange={(e) => onEditField(row.csvRowNumber, 'name', e.target.value)}
          onBlur={onBlurField}
        />
      </td>
      <td className="px-1 py-1.5 align-top">
        <input
          className={cellInputClass}
          value={row.rollNumber}
          placeholder="Roll #"
          onChange={(e) => onEditField(row.csvRowNumber, 'rollNumber', e.target.value)}
          onBlur={onBlurField}
        />
      </td>
      <td className="px-1 py-1.5 align-top">
        {row.status === 'MOVED' && (
          <div className="mb-0.5 px-1.5 text-[11px] text-slate-500 line-through">
            {row.currentClassName} → {row.currentSectionName}
          </div>
        )}
        <div className="flex items-center gap-1">
          <input
            className={cellInputClass}
            value={row.className}
            placeholder="Class"
            onChange={(e) => onEditField(row.csvRowNumber, 'className', e.target.value)}
            onBlur={onBlurField}
          />
          <span className="text-slate-300">/</span>
          <input
            className={cellInputClass}
            value={row.sectionName}
            placeholder="Section"
            onChange={(e) => onEditField(row.csvRowNumber, 'sectionName', e.target.value)}
            onBlur={onBlurField}
          />
        </div>
        {row.classSuggestion && (
          <SuggestionChip label={`Did you mean "${row.classSuggestion}"?`} onApply={() => onApplyClassSuggestion(row)} />
        )}
        {row.sectionSuggestion && (
          <SuggestionChip label={`Did you mean "${row.sectionSuggestion}"?`} onApply={() => onApplySectionSuggestion(row)} />
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </td>
      <td className="px-3 py-2 align-top text-slate-600">
        {row.status === 'ERROR' && row.errors.join(' ')}
        {row.status === 'CONFLICT' &&
          `${row.conflictCount} existing students share this roll number — resolve manually after import.`}
        {row.status === 'UPDATE' && row.changedFields && `Changed: ${row.changedFields.join(', ')}`}
        {row.status === 'DUPLICATE' && 'Appears more than once in this file — only the first row is used.'}
        {row.status === 'MOVED' && (
          <label className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <input type="checkbox" checked={confirmed} onChange={() => onToggleMove(row.csvRowNumber)} />
            Confirm movement
          </label>
        )}

        {aiSuggestion && (
          <div className="mt-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5">
            <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-violet-700">
              <Sparkles size={11} /> AI suggestion
              <span className="ml-auto rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-600">
                {aiSuggestion.confidence}
              </span>
            </div>
            <p className="text-[11px] text-violet-800">{aiSuggestion.note}</p>
            {suggestionHasChanges(row, aiSuggestion) ? (
              <div className="mt-1.5 flex gap-1.5">
                <button
                  onClick={() => onApplyAiSuggestion(row)}
                  className="flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-violet-700"
                >
                  <Check size={11} /> Apply
                </button>
                <button
                  onClick={() => onDismissAiSuggestion(row.csvRowNumber)}
                  className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <button
                onClick={() => onDismissAiSuggestion(row.csvRowNumber)}
                className="mt-1 text-[11px] font-medium text-violet-500 hover:underline"
              >
                Dismiss
              </button>
            )}
          </div>
        )}
        {needsFix && !aiSuggestion && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <Wand2 size={11} /> Edit the fields on the left to fix this row live.
          </p>
        )}
      </td>
    </tr>
  );
}

function SuggestionChip({ label, onApply }: { label: string; onApply: () => void }) {
  return (
    <button
      onClick={onApply}
      className="mt-1 flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
    >
      <Wand2 size={10} /> {label}
    </button>
  );
}
