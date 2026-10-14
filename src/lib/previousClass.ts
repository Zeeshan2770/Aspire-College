/**
 * Previous class / qualification choices on the admission form.
 *
 * The value stored in admissions.previous_class (a text column) is the option label itself, so every screen,
 * report and older record reads naturally. "Other" is stored as "Other: <what the applicant typed>".
 * Records from before the dropdown hold free text; formatPreviousClass shows them unchanged.
 *
 * KEEP IN SYNC with allowed_previous_classes() in supabase/migrations/0029_previous_class_dropdown.sql,
 * which applies the same rules when an application is submitted.
 */

export const PREVIOUS_CLASSES = [
  'Class 8 (Middle)',
  'Class 9 (Matric Part I)',
  'Class 10 (Matric Part II)',
  '1st Year / Class 11 (Intermediate Part I)',
  '2nd Year / Class 12 (Intermediate Part II)',
  'DIT (Diploma in Information Technology)',
  'Other',
] as const;

export type PreviousClass = (typeof PREVIOUS_CLASSES)[number];

export const PREVIOUS_CLASS_OTHER: PreviousClass = 'Other';
const OTHER_PREFIX = 'Other: ';
export const PREVIOUS_CLASS_OTHER_MAX = 120;

/**
 * Choices per program level (programs.level, set in Academics). Matric programs admit students who finished
 * Class 8 (into Class 9) or Class 9 (into Class 10); Intermediate programs admit after Class 10 (1st year) or
 * Class 11 (2nd year). DIT ("Intermediate Equivalent") asks for Matric or equivalent, so anyone from Class 10 up
 * may apply. Any other or missing level shows the full list. "Other" is always offered.
 */
const BY_LEVEL: Record<string, readonly PreviousClass[]> = {
  matric: ['Class 8 (Middle)', 'Class 9 (Matric Part I)', 'Other'],
  intermediate: ['Class 10 (Matric Part II)', '1st Year / Class 11 (Intermediate Part I)', 'Other'],
  'intermediate equivalent': [
    'Class 10 (Matric Part II)', '1st Year / Class 11 (Intermediate Part I)', '2nd Year / Class 12 (Intermediate Part II)', 'Other',
  ],
};

export function previousClassesForLevel(level: string | null | undefined): readonly PreviousClass[] {
  return BY_LEVEL[(level ?? '').trim().toLowerCase()] ?? PREVIOUS_CLASSES;
}

/** The value to submit: the chosen label, or "Other: <text>" (empty when nothing was chosen). */
export function encodePreviousClass(choice: string, other: string): string {
  if (!choice) return '';
  return choice === PREVIOUS_CLASS_OTHER ? `${OTHER_PREFIX}${other.trim()}` : choice;
}

/** Splits a stored value for display. Legacy free text comes back as the label with no "other" part. */
export function formatPreviousClass(stored: string | null | undefined): { label: string; other: string | null } | null {
  const v = stored?.trim();
  if (!v) return null;
  if (v.startsWith(OTHER_PREFIX)) return { label: PREVIOUS_CLASS_OTHER, other: v.slice(OTHER_PREFIX.length).trim() || null };
  return { label: v, other: null };
}
