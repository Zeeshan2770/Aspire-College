const STUDENT_EMAIL_DOMAIN = 'students.aspiretaunsa.com';

/**
 * A student types their Student ID (e.g. "STU-26-0001280") or the full
 * generated username into the login form. Supabase Auth needs an
 * email-shaped identifier either way, so this fills in the domain when
 * the person didn't type one themselves — matching how the Edge
 * Function generates it during account creation (see
 * manage-student-credentials/index.ts).
 */
export function resolveStudentLoginEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@${STUDENT_EMAIL_DOMAIN}`;
}
