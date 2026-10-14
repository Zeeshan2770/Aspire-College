import { ChevronDown, Layers } from 'lucide-react';
import { useState } from 'react';
import { useCrAssignment } from '@/hooks/useCrAssignment';
import clsx from 'clsx';

/**
 * Shows which class/section the CR is currently acting in.
 * If they've been assigned to more than one section, this becomes a
 * dropdown so they can switch — every CR page reacts to the change
 * automatically via useCrAssignment().
 */
export function CrSectionSwitcher({ className }: { className?: string }) {
  const { assignments, assignment, selectSection } = useCrAssignment();
  const [open, setOpen] = useState(false);

  if (!assignment) return null;

  if (assignments.length <= 1) {
    return (
      <div className={clsx('flex gap-2', className)}>
        <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
          Class: {assignment.classes?.name}
        </span>
        <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
          Section: {assignment.sections?.name}
        </span>
      </div>
    );
  }

  return (
    <div className={clsx('relative inline-block', className)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
      >
        <Layers size={13} />
        {assignment.classes?.name} — {assignment.sections?.name}
        <ChevronDown size={13} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-card">
            <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              You're CR of {assignments.length} sections
            </p>
            {assignments.map((a) => (
              <button
                key={a.id}
                onClick={() => { selectSection(a.section_id); setOpen(false); }}
                className={clsx(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50',
                  a.section_id === assignment.section_id ? 'font-semibold text-brand-700' : 'text-ink-800'
                )}
              >
                <span>{a.classes?.name} — {a.sections?.name}</span>
                {a.section_id === assignment.section_id && <span className="text-brand-500">●</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
