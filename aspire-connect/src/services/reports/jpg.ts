import { toJpeg } from 'html-to-image';
import { SystemSettings, ReportBranding } from '@/types';

export interface JpgReportOptions {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  settings: SystemSettings;
  /** Optional per-class/section override for header, footer, and logo. */
  branding?: ReportBranding | null;
  filename: string;
}

/**
 * Renders a WhatsApp-friendly, high-resolution JPG report to a data URL by
 * drawing an off-screen styled DOM node and rasterizing it with
 * html-to-image, without triggering a download — lets the caller preview it
 * first. `generateJpgReport` below wraps this and downloads immediately for
 * callers that don't need a preview step. A per-class/section `branding`
 * override (header text, footer text, logo) takes priority over the global
 * system_settings.
 */
export async function buildJpgDataUrl(opts: JpgReportOptions): Promise<string> {
  const logoUrl = opts.branding?.logo_url || opts.settings.logo_url || null;
  const headerImageUrl = opts.branding?.header_image_url || opts.settings.header_image_url || null;
  const footerImageUrl = opts.branding?.footer_image_url || opts.settings.footer_image_url || null;
  const headerLine = opts.branding?.header_text || opts.settings.header_text || opts.settings.college_name;
  const footerLine =
    opts.branding?.footer_text || opts.settings.footer_text ||
    `${opts.settings.system_name} — Developed By Muhammad Zeeshan Haider`;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '720px';
  container.style.fontFamily = "Inter, ui-sans-serif, system-ui, sans-serif";
  container.style.background = '#ffffff';
  container.style.padding = '0';
  container.style.color = '#0b0f1a';

  const rowsHtml = opts.rows
    .map(
      (r, i) => `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f5f7ff'}">
        ${r.map((c) => `<td style="padding:8px 10px;font-size:12px;border-bottom:1px solid #eef1f8;">${c}</td>`).join('')}
      </tr>`
    )
    .join('');

  const headerHtml = headerImageUrl
    ? `<img src="${headerImageUrl}" crossorigin="anonymous" style="display:block;width:100%;height:auto;" />`
    : `<div style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#2842e2,#3c62ef);padding:20px 24px;color:#fff;">
        ${logoUrl ? `<img src="${logoUrl}" crossorigin="anonymous" style="height:40px;width:40px;border-radius:8px;object-fit:contain;background:#fff;padding:3px;" />` : ''}
        <div>
          <div style="font-size:16px;font-weight:800;">${headerLine}</div>
          <div style="font-size:12px;opacity:.9;">${opts.settings.campus_name}</div>
        </div>
      </div>`;

  const footerHtml = footerImageUrl
    ? `<img src="${footerImageUrl}" crossorigin="anonymous" style="display:block;width:100%;height:auto;" />
       <div style="padding:6px 24px 16px;text-align:right;font-size:10px;color:#94a3b8;">${new Date().toLocaleDateString()}</div>`
    : `<div style="padding:0 24px 20px;">
        <div style="margin-top:18px;padding-top:12px;border-top:1px solid #eef1f8;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;">
          <span>${footerLine}</span>
          <span>${new Date().toLocaleDateString()}</span>
        </div>
      </div>`;

  container.innerHTML = `
    ${headerHtml}
    <div style="padding:20px 24px 0;">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px;">${opts.title}</div>
      ${opts.subtitle ? `<div style="font-size:12px;color:#475569;margin-bottom:12px;">${opts.subtitle}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr style="background:#2842e2;color:#fff;">
            ${opts.columns.map((c) => `<th style="padding:8px 10px;font-size:12px;text-align:left;">${c}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    ${footerHtml}
  `;

  document.body.appendChild(container);
  try {
    return await toJpeg(container, { quality: 0.95, pixelRatio: 2, backgroundColor: '#ffffff' });
  } finally {
    document.body.removeChild(container);
  }
}

/** Triggers the actual download of an already-built JPG data URL. */
export function downloadJpgDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename.endsWith('.jpg') ? filename : `${filename}.jpg`;
  a.click();
}

/**
 * Builds a WhatsApp-friendly, high-resolution JPG report and triggers an
 * immediate browser download (no preview step).
 */
export async function generateJpgReport(opts: JpgReportOptions) {
  const dataUrl = await buildJpgDataUrl(opts);
  downloadJpgDataUrl(dataUrl, opts.filename);
}
