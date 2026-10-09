import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SystemSettings, ReportBranding } from '@/types';

export interface PdfReportOptions {
  title: string;
  subtitle?: string; // e.g. "Class: ICS Part II | Section: Diamond"
  dateRange?: string;
  columns: string[];
  rows: (string | number)[][];
  settings: SystemSettings;
  /** Optional per-class/section override for header, footer, and logo. */
  branding?: ReportBranding | null;
  filename: string;
}

/** Fetches an image URL and returns it as a base64 data URL (for jsPDF.addImage). */
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** jsPDF needs an explicit image format string; infer it from the data URL's mime type. */
function jsPdfFormat(dataUrl: string): 'JPEG' | 'PNG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

/** Loads an image to read its natural pixel dimensions (for aspect-ratio-correct banners). */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

/**
 * Builds a professional, branded PDF report and returns the jsPDF document
 * without saving it — lets the caller preview it before committing to a
 * download. `generatePdfReport` below wraps this and saves immediately for
 * callers that don't need a preview step.
 */
export async function buildPdfDocument(opts: PdfReportOptions): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  const logoUrl = opts.branding?.logo_url || opts.settings.logo_url || null;
  const headerImageUrl = opts.branding?.header_image_url || opts.settings.header_image_url || null;
  const footerImageUrl = opts.branding?.footer_image_url || opts.settings.footer_image_url || null;
  const headerLine = opts.branding?.header_text || opts.settings.header_text || opts.settings.college_name;
  const footerLine =
    opts.branding?.footer_text || opts.settings.footer_text ||
    `${opts.settings.system_name} — Developed By Muhammad Zeeshan Haider`;

  const logoDataUrl = logoUrl ? await toDataUrl(logoUrl) : null;
  const headerImageDataUrl = headerImageUrl ? await toDataUrl(headerImageUrl) : null;
  const footerImageDataUrl = footerImageUrl ? await toDataUrl(footerImageUrl) : null;

  // Header — a full-width banner image if one is set, otherwise the text header.
  let headerBandHeight = 70;
  let headerImageDrawn = false;
  if (headerImageDataUrl) {
    try {
      const dims = await getImageDimensions(headerImageDataUrl);
      headerBandHeight = Math.min(130, pageWidth * (dims.height / dims.width));
      doc.addImage(headerImageDataUrl, jsPdfFormat(headerImageDataUrl), 0, 0, pageWidth, headerBandHeight);
      headerImageDrawn = true;
    } catch {
      // Malformed image — fall back to the text header below.
    }
  }

  if (!headerImageDrawn) {
    headerBandHeight = 70;
    doc.setFillColor(37, 66, 226);
    doc.rect(0, 0, pageWidth, headerBandHeight, 'F');

    let textStartX = margin;
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, jsPdfFormat(logoDataUrl), margin, 12, 46, 46);
        textStartX = margin + 58;
      } catch {
        // Malformed image — silently fall back to text-only header.
      }
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(headerLine, textStartX, 30);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(opts.settings.campus_name, textStartX, 46);
    doc.setFontSize(9);
    doc.text(opts.settings.system_name, pageWidth - margin, 30, { align: 'right' });
    doc.text(new Date().toLocaleString(), pageWidth - margin, 46, { align: 'right' });
  }

  // Title block
  let y = headerBandHeight + 22;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.title, margin, y);
  y += 18;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (opts.subtitle) {
    doc.text(opts.subtitle, margin, y);
    y += 14;
  }
  if (opts.dateRange) {
    doc.text(`Date Range: ${opts.dateRange}`, margin, y);
    y += 14;
  }

  // Table
  autoTable(doc, {
    startY: y + 6,
    head: [opts.columns],
    body: opts.rows.map((r) => r.map(String)),
    headStyles: { fillColor: [37, 66, 226], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    styles: { fontSize: 9, cellPadding: 6 },
    margin: { left: margin, right: margin },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      if (footerImageDataUrl) {
        // Full-width banner image at the bottom, page number placed just above it.
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 42, { align: 'right' });
        try {
          const naturalRatio = 0.18; // approximate band height as a fraction of width; clamped below
          const bandHeight = Math.min(90, pageWidth * naturalRatio);
          doc.addImage(footerImageDataUrl, jsPdfFormat(footerImageDataUrl), 0, pageHeight - bandHeight, pageWidth, bandHeight);
        } catch {
          // Malformed image — fall back to the text footer below.
          doc.text(footerLine, margin, pageHeight - 20);
        }
      } else {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(footerLine, margin, pageHeight - 20);
        doc.text(
          `Page ${doc.getNumberOfPages()}`,
          pageWidth - margin,
          pageHeight - 20,
          { align: 'right' }
        );
      }
    },
  });

  return doc;
}

/**
 * Builds a professional, branded PDF report and triggers an immediate
 * browser download (no preview step). Used for attendance reports, student
 * attendance reports, class reports, and student concern reports. A
 * per-class/section `branding` override (header text, footer text, logo)
 * takes priority over the global system_settings, matching the fallback
 * used across the app.
 */
export async function generatePdfReport(opts: PdfReportOptions) {
  const doc = await buildPdfDocument(opts);
  saveDocument(doc, opts.filename);
}

/** Triggers the actual download of an already-built PDF document. */
export function saveDocument(doc: jsPDF, filename: string) {
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Renders a built PDF document to an in-memory object URL, for previewing before download. Call `URL.revokeObjectURL(url)` once the preview is closed. */
export function pdfPreviewUrl(doc: jsPDF): string {
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}
