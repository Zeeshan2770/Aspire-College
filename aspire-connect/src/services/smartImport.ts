import { supabase } from '@/lib/supabase';
import { ClassRow, SectionRow, Student } from '@/types';
import { RawCsvRow, comparisonKey } from '@/services/csv';
import { findStudentsByRollNumbers } from '@/services/students';
import { closestMatch } from '@/services/fuzzyMatch';

export type RowStatus = 'NEW' | 'EXISTING' | 'UPDATE' | 'MOVED' | 'DUPLICATE' | 'CONFLICT' | 'ERROR';

export interface PlanRow {
  csvRowNumber: number; // 1-indexed, matches spreadsheet row (header excluded)
  name: string;
  fatherName: string;
  rollNumber: string;
  className: string;
  sectionName: string;
  phone: string;
  status: RowStatus;
  errors: string[];
  studentId?: string;
  currentClassName?: string;
  currentSectionName?: string;
  changedFields?: string[];
  conflictCount?: number;
  /** A close-but-not-exact match against a known class/section name — surfaced as a one-click "did you mean…" fix, never auto-applied. */
  classSuggestion?: string;
  sectionSuggestion?: string;
}

export interface StructureSectionNode {
  name: string;
  existing: boolean;
}

export interface StructureClassNode {
  name: string;
  existing: boolean;
  sections: StructureSectionNode[];
}

export interface ImportCounts {
  total: number;
  new: number;
  existing: number;
  updates: number;
  moved: number;
  duplicates: number;
  conflicts: number;
  errors: number;
}

export interface ImportPlan {
  rows: PlanRow[];
  structure: StructureClassNode[];
  counts: ImportCounts;
  headerWarnings: string[];
}

function emptyCounts(): ImportCounts {
  return { total: 0, new: 0, existing: 0, updates: 0, moved: 0, duplicates: 0, conflicts: 0, errors: 0 };
}

/**
 * Analyzes parsed CSV rows against the current academic structure and
 * existing students, producing a full preview plan. Read-only — nothing
 * is written to the database here.
 */
export async function buildImportPlan(
  csvRows: RawCsvRow[],
  classes: ClassRow[],
  sections: SectionRow[],
  headerWarnings: string[] = []
): Promise<ImportPlan> {
  // ---------- pass 1: required-field validation ----------
  const draft: PlanRow[] = csvRows.map((r, idx) => {
    const errors: string[] = [];
    if (!r.name) errors.push('Student Name Missing.');
    if (!r.rollNumber) errors.push('Roll Number Missing.');
    if (!r.class) errors.push('Class Missing.');
    if (!r.section) errors.push('Section Missing.');
    return {
      csvRowNumber: idx + 1,
      name: r.name,
      fatherName: r.fatherName,
      rollNumber: r.rollNumber,
      className: r.class,
      sectionName: r.section,
      phone: r.phone,
      status: errors.length ? ('ERROR' as RowStatus) : ('NEW' as RowStatus), // placeholder, refined below
      errors,
    };
  });

  // ---------- pass 2: fetch existing students by roll number ----------
  const validRollNumbers = draft.filter((r) => r.errors.length === 0).map((r) => r.rollNumber);
  const existingStudents = await findStudentsByRollNumbers(validRollNumbers);
  const byRollKey = new Map<string, Student[]>();
  for (const s of existingStudents) {
    const key = comparisonKey(s.roll_number);
    const list = byRollKey.get(key) ?? [];
    list.push(s);
    byRollKey.set(key, list);
  }

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const sectionNameById = new Map(sections.map((s) => [s.id, s.name]));
  const allClassNames = classes.map((c) => c.name);

  // ---------- pass 3: classify (duplicates, existing/update, moved, conflict) ----------
  const seenRollKeys = new Set<string>();

  for (const row of draft) {
    if (row.errors.length) {
      row.status = 'ERROR';
      continue;
    }

    // Typo-tolerant "did you mean…" suggestions against known structure —
    // purely advisory, the row is still classified on the name as typed.
    const classMatch = classes.some((c) => comparisonKey(c.name) === comparisonKey(row.className))
      ? null
      : closestMatch(row.className, allClassNames);
    if (classMatch) row.classSuggestion = classMatch.value;

    const sectionNamesInClass = sections
      .filter((s) => classMatch ? comparisonKey(classNameById.get(s.class_id) ?? '') === comparisonKey(classMatch.value)
        : comparisonKey(classNameById.get(s.class_id) ?? '') === comparisonKey(row.className))
      .map((s) => s.name);
    const sectionMatch = sectionNamesInClass.some((n) => comparisonKey(n) === comparisonKey(row.sectionName))
      ? null
      : closestMatch(row.sectionName, sectionNamesInClass);
    if (sectionMatch) row.sectionSuggestion = sectionMatch.value;

    const rollKey = comparisonKey(row.rollNumber);

    if (seenRollKeys.has(rollKey)) {
      row.status = 'DUPLICATE';
      continue;
    }
    seenRollKeys.add(rollKey);

    const matches = byRollKey.get(rollKey) ?? [];

    if (matches.length === 0) {
      row.status = 'NEW';
    } else if (matches.length > 1) {
      row.status = 'CONFLICT';
      row.conflictCount = matches.length;
    } else {
      const m = matches[0];
      const currentClassName = classNameById.get(m.class_id) ?? '(unknown class)';
      const currentSectionName = sectionNameById.get(m.section_id) ?? '(unknown section)';
      row.studentId = m.id;
      row.currentClassName = currentClassName;
      row.currentSectionName = currentSectionName;

      const sameClass = comparisonKey(currentClassName) === comparisonKey(row.className);
      const sameSection = comparisonKey(currentSectionName) === comparisonKey(row.sectionName);

      if (!sameClass || !sameSection) {
        row.status = 'MOVED';
      } else {
        const changedFields: string[] = [];
        if ((m.full_name ?? '').trim() !== row.name.trim()) changedFields.push('name');
        if (row.fatherName && (m.father_name ?? '').trim() !== row.fatherName.trim()) changedFields.push('father name');
        if ((m.phone ?? '').trim() !== row.phone.trim()) changedFields.push('phone');
        row.status = changedFields.length ? 'UPDATE' : 'EXISTING';
        row.changedFields = changedFields;
      }
    }
  }

  // ---------- structure preview ----------
  // Only rows that will actually touch the DB (new inserts or confirmed
  // moves) can introduce new structure; existing/update rows already sit
  // in structure that exists by definition.
  const structureRelevant = draft.filter((r) => r.status === 'NEW' || r.status === 'MOVED' || r.status === 'UPDATE' || r.status === 'EXISTING');
  const classMap = new Map<string, StructureClassNode>();
  for (const r of structureRelevant) {
    const classKey = comparisonKey(r.className);
    const classExists = classes.some((c) => comparisonKey(c.name) === classKey);
    if (!classMap.has(classKey)) {
      classMap.set(classKey, { name: r.className, existing: classExists, sections: [] });
    }
    const node = classMap.get(classKey)!;
    const sectionKey = comparisonKey(r.sectionName);
    if (!node.sections.some((s) => comparisonKey(s.name) === sectionKey)) {
      const sectionExists =
        classExists &&
        sections.some(
          (s) =>
            comparisonKey(s.name) === sectionKey &&
            comparisonKey(classNameById.get(s.class_id) ?? '') === classKey
        );
      node.sections.push({ name: r.sectionName, existing: sectionExists });
    }
  }

  const counts = emptyCounts();
  counts.total = draft.length;
  for (const r of draft) {
    if (r.status === 'NEW') counts.new++;
    else if (r.status === 'EXISTING') counts.existing++;
    else if (r.status === 'UPDATE') counts.updates++;
    else if (r.status === 'MOVED') counts.moved++;
    else if (r.status === 'DUPLICATE') counts.duplicates++;
    else if (r.status === 'CONFLICT') counts.conflicts++;
    else if (r.status === 'ERROR') counts.errors++;
  }

  return {
    rows: draft,
    structure: Array.from(classMap.values()),
    counts,
    headerWarnings,
  };
}

/**
 * Re-runs the full analysis after the admin edits one or more rows inline
 * in the review table (the "live find and fix" loop) — cheap enough to call
 * on every edit since it's the same batched query buildImportPlan already
 * does once at upload time.
 */
export async function reanalyzePlan(
  rows: PlanRow[],
  classes: ClassRow[],
  sections: SectionRow[],
  headerWarnings: string[]
): Promise<ImportPlan> {
  const rawRows: RawCsvRow[] = rows.map((r) => ({
    name: r.name, fatherName: r.fatherName, rollNumber: r.rollNumber,
    class: r.className, section: r.sectionName, phone: r.phone,
  }));
  return buildImportPlan(rawRows, classes, sections, headerWarnings);
}

export interface ApplyImportOptions {
  updateExisting: boolean;
  confirmedMovementRowNumbers: Set<number>;
  filename: string;
}

export interface ApplyImportResult {
  totalRows: number;
  studentsCreated: number;
  studentsUpdated: number;
  studentsMoved: number;
  studentsSkipped: number;
  classesCreated: string[];
  sectionsCreated: { class: string; section: string }[];
}

/**
 * Commits the plan via the atomic `apply_student_import` Postgres function.
 * Either the whole import lands, or (on any error) nothing does.
 */
export async function applyImportPlan(plan: ImportPlan, options: ApplyImportOptions): Promise<ApplyImportResult> {
  type IncludedAction = 'insert' | 'update' | 'move';
  const included: { row: PlanRow; action: IncludedAction }[] = [];

  for (const row of plan.rows) {
    if (row.status === 'NEW') included.push({ row, action: 'insert' });
    else if (row.status === 'UPDATE' && options.updateExisting) included.push({ row, action: 'update' });
    else if (row.status === 'MOVED' && options.confirmedMovementRowNumbers.has(row.csvRowNumber)) {
      included.push({ row, action: 'move' });
    }
    // EXISTING (unchanged), DUPLICATE, CONFLICT, ERROR, un-toggled UPDATE and
    // unconfirmed MOVED rows are intentionally left out — they are skipped.
  }

  const classNamesNeeded = new Set<string>();
  const sectionPairsNeeded = new Map<string, { class: string; section: string }>();
  for (const { row } of included) {
    classNamesNeeded.add(row.className);
    sectionPairsNeeded.set(`${comparisonKey(row.className)}|${comparisonKey(row.sectionName)}`, {
      class: row.className,
      section: row.sectionName,
    });
  }

  const payload = {
    source_filename: options.filename,
    classes: Array.from(classNamesNeeded),
    sections: Array.from(sectionPairsNeeded.values()),
    rows: included.map(({ row, action }) => ({
      action,
      student_id: row.studentId ?? null,
      full_name: row.name,
      father_name: row.fatherName || null,
      roll_number: row.rollNumber,
      class: row.className,
      section: row.sectionName,
      phone: row.phone || null,
    })),
  };

  if (!payload.rows.length) {
    throw new Error('Nothing to import — every row was skipped, a duplicate, a conflict, or had an error.');
  }

  const { data, error } = await supabase.rpc('apply_student_import', { payload });
  if (error) throw new Error(friendlyImportError(error.message));

  const skippedClientSide = plan.rows.length - included.length;

  return {
    totalRows: plan.rows.length,
    studentsCreated: data?.students_created ?? 0,
    studentsUpdated: data?.students_updated ?? 0,
    studentsMoved: data?.students_moved ?? 0,
    studentsSkipped: skippedClientSide,
    classesCreated: data?.classes_created ?? [],
    sectionsCreated: data?.sections_created ?? [],
  };
}

export interface ImportReportMeta {
  filename: string;
  performedBy: string;
  timestamp?: Date;
}

export function downloadImportReport(result: ApplyImportResult, meta: ImportReportMeta) {
  const when = meta.timestamp ?? new Date();
  const lines = [
    'ASPIRE GROUP OF COLLEGES — STUDENT CSV IMPORT REPORT',
    '',
    `Timestamp: ${when.toLocaleString()}`,
    `Imported by: ${meta.performedBy}`,
    `Source file: ${meta.filename}`,
    '',
    `Total rows: ${result.totalRows}`,
    `Students created: ${result.studentsCreated}`,
    `Students updated: ${result.studentsUpdated}`,
    `Students moved: ${result.studentsMoved}`,
    `Students skipped: ${result.studentsSkipped}`,
    `Classes created: ${result.classesCreated.length}${
      result.classesCreated.length ? ' (' + result.classesCreated.join(', ') + ')' : ''
    }`,
    `Sections created: ${result.sectionsCreated.length}${
      result.sectionsCreated.length
        ? ' (' + result.sectionsCreated.map((s) => `${s.class} → ${s.section}`).join('; ') + ')'
        : ''
    }`,
  ].join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-report-${when.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function friendlyImportError(message: string): string {
  if (!message) return 'Import could not be completed. No student records were changed.';
  if (message.startsWith('PERMISSION_DENIED')) {
    return "You don't have permission to import students. Ask a Main Super Admin to grant the Import Students permission.";
  }
  if (/permission denied for/i.test(message)) {
    return 'Import could not be completed. No student records were changed.';
  }
  // Our own function already raises human-readable messages (e.g. "Roll
  // number 101 already exists in 1st Year → Pre-Medical."); pass those
  // through as-is. Anything unrecognized falls back to a safe generic line.
  if (/^Roll number|^Class "|^Section "|^Student |^Unknown import action/.test(message)) {
    return message;
  }
  return 'Import could not be completed. No student records were changed.';
}
