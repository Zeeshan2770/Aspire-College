import { AppRole } from '@/types';

export type PortalKey = 'super-admin' | 'administration' | 'principal' | 'teacher-cr' | 'student';

export interface PortalRole {
  key: PortalKey;
  /** The role the database must report for this portal. */
  role: AppRole;
  label: string;
  blurb: string;
  /** Students sign in with a Student ID; everyone else uses an email address. */
  kind: 'staff' | 'student';
  home: string;
}

export const PORTAL_ROLES: PortalRole[] = [
  { key: 'super-admin', role: 'MAIN_SUPER_ADMIN', label: 'Super Admin', blurb: 'Full system access', kind: 'staff', home: '/admin' },
  { key: 'administration', role: 'SUB_SUPER_ADMIN', label: 'Administration', blurb: 'College administration staff', kind: 'staff', home: '/sub-admin' },
  { key: 'principal', role: 'PRINCIPAL', label: 'Principal', blurb: 'Oversight and reports', kind: 'staff', home: '/principal' },
  { key: 'teacher-cr', role: 'CR', label: 'Teacher / CR', blurb: 'Attendance and class concerns', kind: 'staff', home: '/cr' },
  { key: 'student', role: 'STUDENT', label: 'Student', blurb: 'Sign in with your Student ID', kind: 'student', home: '/student' },
];

export function portalFromKey(key: string | null | undefined): PortalRole | undefined {
  return PORTAL_ROLES.find((p) => p.key === key);
}

export function portalHomeForRole(role?: string): string {
  return PORTAL_ROLES.find((p) => p.role === role)?.home ?? '/cr';
}
