import { Student, SystemSettings } from '@/types';

export interface QuickReportInput {
  student: Pick<Student, 'full_name' | 'father_name' | 'roll_number'>;
  className: string;
  sectionName: string;
  concernType: string;
  description: string;
  crName: string;
  settings: SystemSettings | null;
  date?: Date;
}

/** Builds the editable professional report message shown before sending. */
export function generateReportMessage(input: QuickReportInput): string {
  const { student, className, sectionName, concernType, description, crName, settings, date = new Date() } = input;
  const signature = settings?.default_report_signature?.trim() || 'Aspire Group of Colleges, Taunsa Sharif';
  const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return [
    'Assalam-o-Alaikum Sir,',
    '',
    'This is to report a concern regarding:',
    '',
    `Student Name: ${student.full_name}`,
    `Father Name: ${student.father_name || 'N/A'}`,
    `Roll Number: ${student.roll_number}`,
    `Class: ${className}`,
    `Section: ${sectionName}`,
    '',
    `Concern: ${concernType}`,
    '',
    'Details:',
    description || '—',
    '',
    `Date: ${dateStr}`,
    `Reported by: ${crName}`,
    '',
    'Kindly look into the matter and take appropriate action.',
    '',
    'Regards,',
    signature,
  ].join('\n');
}

/** Strips everything but digits and a leading + so WhatsApp/tel links work regardless of how the number was typed in Settings. */
function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  return hasPlus ? `+${digits}` : digits;
}

export interface Coordinator {
  name: string;
  whatsapp: string;
}

export function getConfiguredCoordinators(settings: SystemSettings | null): Coordinator[] {
  if (!settings) return [];
  const list: Coordinator[] = [];
  if (settings.coordinator_whatsapp) {
    list.push({ name: settings.coordinator_name || 'Coordinator', whatsapp: settings.coordinator_whatsapp });
  }
  if (settings.coordinator_secondary_whatsapp) {
    list.push({ name: settings.coordinator_secondary_name || 'Secondary Coordinator', whatsapp: settings.coordinator_secondary_whatsapp });
  }
  return list;
}

/**
 * Opens (does not send) a WhatsApp conversation pre-filled with the
 * message. wa.me only supports numbers, not saved-contact lookup, so a
 * coordinator number must be configured in Super Admin → Settings.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const number = normalizePhone(phone).replace('+', '');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function buildSmsLink(phone: string, message: string): string {
  const number = normalizePhone(phone);
  // iOS uses '&body=', most Android browsers use '?body='; '?' is the more broadly supported default.
  return `sms:${number}?body=${encodeURIComponent(message)}`;
}

export async function copyMessage(message: string): Promise<void> {
  await navigator.clipboard.writeText(message);
}

export async function shareMessage(message: string, title = 'Student Report'): Promise<'shared' | 'unsupported'> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: message });
      return 'shared';
    } catch (err: any) {
      // AbortError means the person cancelled the native share sheet — not a failure.
      if (err?.name === 'AbortError') return 'shared';
      throw err;
    }
  }
  return 'unsupported';
}
