export type AppRole = 'MAIN_SUPER_ADMIN' | 'PRINCIPAL' | 'SUB_SUPER_ADMIN' | 'CR' | 'STUDENT';
export type StudentStatus = 'ACTIVE' | 'INACTIVE';
export type AttendanceStatus = 'PRESENT' | 'ABSENT';
export type ConcernStatus =
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'UNDER_REVIEW'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';
export type ConcernPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ConcernScope = 'PERSONAL' | 'SECTION' | 'CLASS' | 'INSTITUTION';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: AppRole;
  is_active: boolean;
  /** True right after a Student Portal account is created (or its password reset) — cleared once the student sets their own password. */
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportBranding {
  id: string;
  class_id: string | null;
  section_id: string | null;
  header_text: string | null;
  footer_text: string | null;
  /** Optional full-width header banner image. When set, it's used instead of header_text. */
  header_image_url: string | null;
  /** Optional full-width footer banner image. When set, it's used instead of footer_text. */
  footer_image_url: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminPermissions {
  id: string;
  profile_id: string;
  manage_students: boolean;
  manage_classes: boolean;
  manage_sections: boolean;
  manage_crs: boolean;
  view_attendance: boolean;
  manage_attendance: boolean;
  view_concerns: boolean;
  manage_concerns: boolean;
  raise_concerns: boolean;
  generate_reports: boolean;
  import_students: boolean;
  export_students: boolean;
  manage_admissions: boolean;
  manage_faculty: boolean;
  manage_content: boolean;
}

export interface ClassRow {
  id: string;
  name: string;
  created_at: string;
}

export interface SectionRow {
  id: string;
  class_id: string;
  name: string;
  created_at: string;
}

export interface Student {
  id: string;
  full_name: string;
  father_name: string | null;
  roll_number: string;
  class_id: string;
  section_id: string;
  phone: string | null;
  status: StudentStatus;
  /** Links to profiles.id once a Student Portal login exists. Null = no account yet. */
  user_id: string | null;
  /** Permanent Student ID, e.g. "STU-26-0001280". Null until an account is created. */
  student_uid: string | null;
  /** Academic session/batch, e.g. "2024-26". Optional, purely informational. */
  session_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrAssignment {
  id: string;
  cr_user_id: string;
  class_id: string;
  section_id: string;
  is_active: boolean;
  assigned_at: string;
  assigned_by: string | null;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  section_id: string;
  date: string;
  /** Legacy per-lecture slot, retained only for historical sessions recorded before attendance was simplified to one daily present/absent mark. Always null on new sessions. */
  lecture_number: number | null;
  subject: string | null;
  teacher: string | null;
  taken_by: string;
  /** 'MANUAL' (default) or 'OCR_SCAN' — provenance only, does not change how the record is used. */
  source?: 'MANUAL' | 'OCR_SCAN';
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  attendance_session_id: string;
  student_id: string;
  status: AttendanceStatus;
  created_at: string;
}

export interface StudentConcern {
  id: string;
  student_id: string | null;
  class_id: string | null;
  section_id: string | null;
  reported_by: string;
  created_by_role: AppRole;
  concern_type: string;
  short_description: string;
  additional_notes: string | null;
  priority: ConcernPriority;
  scope: ConcernScope;
  status: ConcernStatus;
  assigned_to: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConcernComment {
  id: string;
  concern_id: string;
  author_id: string;
  author_role: AppRole;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export type ConcernHistoryAction =
  | 'CREATED'
  | 'ACKNOWLEDGED'
  | 'ASSIGNED'
  | 'STATUS_CHANGED'
  | 'COMMENT_ADDED'
  | 'PRIORITY_CHANGED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';

export interface ConcernHistoryEntry {
  id: string;
  concern_id: string;
  actor_id: string | null;
  actor_role: AppRole | null;
  action: ConcernHistoryAction | string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: string;
}

export interface ConcernAttachment {
  id: string;
  concern_id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export type ConcernNotificationType = 'NEW_CONCERN' | 'ASSIGNED' | 'COMMENT' | 'STATUS_CHANGE' | 'RESOLVED' | 'REOPENED';

export interface ConcernNotification {
  id: string;
  profile_id: string;
  concern_id: string;
  type: ConcernNotificationType | string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const CONCERN_CATEGORIES = [
  'Academic Issue',
  'Attendance Issue',
  'Student Welfare',
  'Classroom Issue',
  'Teacher/Faculty Concern',
  'Administrative Issue',
  'Infrastructure/Facility',
  'Examination Issue',
  'Scholarship / Financial Guidance',
  'Safety / Security',
  'Technical Issue',
  'General Concern',
  'Other',
];

/** Categories shown in the Student Portal's "Raise a Query" form — student-facing wording, stored in the same free-text concern_type column as every other concern category above. */
export const STUDENT_QUERY_CATEGORIES = [
  'Academic Issue',
  'Examination Issue',
  'Attendance Issue',
  'Teacher / Faculty Concern',
  'Classroom / Facility Issue',
  'Technical Issue',
  'Scholarship / Financial Guidance',
  'Student Welfare',
  'Safety / Security',
  'General Query',
  'Other',
];

export interface AdminActivityLog {
  id: string;
  admin_id: string;
  admin_name: string;
  admin_role: AppRole;
  action: string;
  target: string | null;
  description: string;
  created_at: string;
}

export interface SystemSettings {
  id: number;
  college_name: string;
  campus_name: string;
  system_name: string;
  logo_url: string | null;
  /** Global fallback header/footer text, used when a class/section has no override. */
  header_text: string | null;
  footer_text: string | null;
  /** Global fallback header/footer banner image. When set, it's used instead of the text above. */
  header_image_url: string | null;
  footer_image_url: string | null;
  concern_categories: string[];
  /** Communication settings — used by Quick Reports & Messages. */
  coordinator_name: string | null;
  coordinator_whatsapp: string | null;
  coordinator_secondary_name: string | null;
  coordinator_secondary_whatsapp: string | null;
  default_report_signature: string;
  /** Developer credit. */
  credit_enabled: boolean;
  credit_text: string;
  credit_logo_url: string | null;
  /** Attendance settings. */
  default_attendance_behavior: 'ALL_PRESENT' | 'ALL_UNMARKED';
  allow_ocr_scanning: boolean;
  ocr_review_required: boolean;
  updated_at: string;
}

/** Quick-select categories for the Quick Reports & Messages panel (CR → coordinator). */
export const QUICK_REPORT_CATEGORIES: string[] = [
  'Mobile Phone Use',
  'Bullying',
  'Disturbing the Class',
  'Misbehavior',
  'Disrespectful Behavior',
  'Late / Irregular Attendance',
  'Leaving Class Without Permission',
  'Academic Concern',
  'Repeated Absence',
  'Other',
];

export type OcrAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'UNCLEAR';

export interface OcrReviewRow {
  rollNumber: string;
  studentId: string | null;
  studentName: string | null;
  detectedStatus: OcrAttendanceStatus;
  confidence: number;
  matched: boolean;
}

export const QUICK_CONCERNS: { label: string; short_description: string }[] = [
  { label: 'Using Mobile Phone', short_description: 'Using a mobile phone during the lecture.' },
  { label: 'Disturbing the Class', short_description: 'Repeatedly disturbing the classroom environment.' },
  { label: 'Bullying', short_description: 'Inappropriate behavior towards another student.' },
  { label: 'Misbehavior', short_description: 'Misbehavior during classroom activities.' },
  { label: 'Excessive Talking', short_description: 'Repeatedly talking and disrupting the lecture.' },
  { label: 'Sleeping During Lecture', short_description: 'Sleeping during the lecture.' },
  { label: 'Disrespectful Behavior', short_description: 'Disrespectful behavior towards classmates or staff.' },
  { label: 'Repeated Disruption', short_description: 'Repeatedly causing disruption during class.' },
  { label: 'Other', short_description: '' },
];

export type AnnouncementPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface Announcement {
  id: string;
  created_by: string;
  created_by_name: string;
  created_by_role: AppRole;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  target_roles: AppRole[];
  is_pinned: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export type LoginEventType = 'LOGIN' | 'ACCOUNT_CREATED' | 'EMAIL_CHANGED' | 'PASSWORD_CHANGED';

export interface LoginSession {
  id: string;
  user_id: string;
  user_name: string;
  user_role: AppRole;
  event_type: LoginEventType;
  description: string;
  performed_by: string | null;
  performed_by_name: string | null;
  created_at: string;
}

export interface CrCredential {
  id: string;
  cr_user_id: string;
  class_id: string | null;
  section_id: string | null;
  email: string;
  temp_password: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type WarningSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CrWarning {
  id: string;
  cr_user_id: string;
  issued_by: string;
  issued_by_name: string;
  severity: WarningSeverity;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
}
