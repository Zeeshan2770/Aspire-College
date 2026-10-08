import Papa from 'papaparse';
import { ClassRow, SectionRow, Student } from '@/types';

// =====================================================================
// Canonical fields + header aliasing
// =====================================================================

export type CanonicalField = 'name' | 'fatherName' | 'rollNumber' | 'class' | 'section' | 'phone';

const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  name: ['student name', 'name', 'full name', 'student', 'studentname', 'fullname'],
  fatherName: ['father name', 'father', 'fathername', "father's name", 'guardian name', 'guardianname'],
  rollNumber: ['roll number', 'roll no', 'roll #', 'rollnumber', 'roll no.', 'rollno', 'roll'],
  class: ['class', 'class name', 'grade', 'program', 'classname'],
  section: ['section', 'section name', 'group', 'sectionname'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'phonenumber', 'mobilenumber'],
};

/** trim -> lowercase -> collapse whitespace/underscores/hyphens to single spaces */
export function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '') // strip BOM if PapaParse left it on the first header
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveCanonicalField(normalizedHeader: string): CanonicalField | null {
  for (const field of Object.keys(HEADER_ALIASES) as CanonicalField[]) {
    if (HEADER_ALIASES[field].includes(normalizedHeader)) return field;
  }
  return null;
}

/** Trim only — never mangle a name the admin actually typed. */
export function normalizeName(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

/** Trim + collapse internal whitespace. Case is preserved (used for display); use toLowerCase() separately when comparing. */
export function normalizeClassName(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeSectionName(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeRollNumber(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

/** Case/whitespace-insensitive comparison key for classes and sections. */
export function comparisonKey(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// =====================================================================
// Parsing
// =====================================================================

export interface RawCsvRow {
  name: string;
  fatherName: string;
  rollNumber: string;
  class: string;
  section: string;
  phone: string;
}

export interface ParsedCsv {
  rows: RawCsvRow[];
  /** Original header row exactly as it appeared, for diagnostics. */
  originalHeaders: string[];
  /** Headers that couldn't be mapped to a canonical field — informational, not fatal. */
  unmappedHeaders: string[];
  /** Canonical fields that no column in the file mapped to. */
  missingHeaders: CanonicalField[];
  warnings: string[];
}

export function parseStudentCsv(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    const unmappedHeaders: string[] = [];
    const seenCanonical = new Set<CanonicalField>();
    const originalHeaders: string[] = [];
    const warnings: string[] = [];

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy', // drops rows that are empty or whitespace-only
      transformHeader: (h) => {
        originalHeaders.push(h);
        const normalized = normalizeHeader(h);
        const canonical = resolveCanonicalField(normalized);
        if (canonical) {
          if (seenCanonical.has(canonical)) {
            warnings.push(`Duplicate column for "${canonical}" — the first matching column was used.`);
          }
          seenCanonical.add(canonical);
        } else if (normalized) {
          unmappedHeaders.push(h);
        }
        // Return the canonical field name (first match wins); PapaParse keys
        // rows by this. Unmapped headers keep a unique ignored key so we
        // don't silently drop or collide on unrecognized columns.
        return canonical ?? `__ignored__${h}`;
      },
      complete: (results) => {
        const rows: RawCsvRow[] = results.data.map((r) => ({
          name: normalizeName(r.name),
          fatherName: normalizeName(r.fatherName),
          rollNumber: normalizeRollNumber(r.rollNumber),
          class: normalizeClassName(r.class),
          section: normalizeSectionName(r.section),
          phone: normalizeName(r.phone),
        }));

        const missingHeaders = (['name', 'rollNumber', 'class', 'section'] as CanonicalField[]).filter(
          (f) => !seenCanonical.has(f)
        );

        if (results.errors?.length) {
          for (const e of results.errors) {
            if (e.code === 'TooFewFields' || e.code === 'TooManyFields') {
              warnings.push(`Row ${((e.row ?? 0) as number) + 1}: malformed row (${e.message}).`);
            }
          }
        }

        resolve({ rows, originalHeaders, unmappedHeaders, missingHeaders, warnings });
      },
      error: (err) => reject(err),
    });
  });
}

// =====================================================================
// Export + template
// =====================================================================

export function exportStudentsToCsv(
  students: Student[],
  classes: ClassRow[],
  sections: SectionRow[],
  filename = 'students.csv'
) {
  const rows = students.map((s) => ({
    'Student Name': s.full_name,
    'Father Name': s.father_name ?? '',
    'Roll Number': s.roll_number,
    Class: classes.find((c) => c.id === s.class_id)?.name ?? '',
    Section: sections.find((sec) => sec.id === s.section_id)?.name ?? '',
    Phone: s.phone ?? '',
    Status: s.status,
  }));
  const csv = Papa.unparse(rows);
  downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
}

/** Exports freshly-generated Student Portal credentials (e.g. from a bulk account-creation run) so an admin can hand them out or archive them. */
export function exportCredentialsToCsv(
  rows: { full_name: string; roll_number: string; student_uid: string; username: string; temp_password: string }[],
  filename = 'student-credentials.csv'
) {
  const csvRows = rows.map((r) => ({
    'Student Name': r.full_name,
    'Roll Number': r.roll_number,
    'Student ID': r.student_uid,
    Username: r.username,
    'Temporary Password': r.temp_password,
  }));
  const csv = Papa.unparse(csvRows);
  downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
}

export function downloadCsvTemplate(filename = 'student-import-template.csv') {
  const csv = Papa.unparse({
    fields: ['Student Name', 'Father Name', 'Roll Number', 'Class', 'Section', 'Phone'],
    data: [
      ['Ali Khan', 'Muhammad Khan', '101', '1st Year', 'Pre-Medical', ''],
      ['Ahmed Raza', 'Tariq Raza', '102', '1st Year', 'Computer Science', ''],
    ],
  });
  downloadBlob(csv, filename, 'text/csv;charset=utf-8;');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
