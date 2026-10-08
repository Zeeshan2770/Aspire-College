import { supabase } from '@/lib/supabase';
import { ClassRow, SectionRow } from '@/types';
import { PlanRow } from '@/services/smartImport';
import { comparisonKey } from '@/services/csv';

export interface RowSuggestion {
  csvRowNumber: number;
  name?: string;
  fatherName?: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
  phone?: string;
  note: string;
  confidence: 'high' | 'medium' | 'low';
}

function issueFor(row: PlanRow): string {
  if (row.status === 'ERROR') return row.errors.join(' ');
  if (row.status === 'CONFLICT') return `Roll number matches ${row.conflictCount} different existing students.`;
  if (row.status === 'DUPLICATE') return 'This roll number appears more than once in the file.';
  return 'Needs review.';
}

/**
 * Sends rows the deterministic engine couldn't resolve (after required-field
 * checks and fuzzy class/section matching already ran client-side) to the
 * optional AI-assist edge function. Read-only — returns suggestions for the
 * wizard to show; nothing is applied automatically.
 */
export async function requestAiFixes(
  rows: PlanRow[],
  classes: ClassRow[],
  sections: SectionRow[]
): Promise<RowSuggestion[]> {
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const payload = {
    rows: rows.map((r) => ({
      csvRowNumber: r.csvRowNumber, name: r.name, fatherName: r.fatherName, rollNumber: r.rollNumber,
      className: r.className, sectionName: r.sectionName, phone: r.phone, issue: issueFor(r),
    })),
    knownClasses: classes.map((c) => c.name),
    knownSections: sections.map((s) => ({ class: classNameById.get(s.class_id) ?? '', section: s.name })),
  };

  const { data, error } = await supabase.functions.invoke('smart-csv-assist', { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.suggestions ?? []) as RowSuggestion[];
}

/** True if a suggestion actually differs from the row's current values (avoids showing a no-op "fix"). */
export function suggestionHasChanges(row: PlanRow, s: RowSuggestion): boolean {
  const fields: [keyof RowSuggestion, string][] = [
    ['name', row.name], ['fatherName', row.fatherName], ['rollNumber', row.rollNumber],
    ['className', row.className], ['sectionName', row.sectionName], ['phone', row.phone],
  ];
  return fields.some(([key, current]) => {
    const v = s[key];
    return typeof v === 'string' && v.trim() && comparisonKey(v) !== comparisonKey(current);
  });
}
