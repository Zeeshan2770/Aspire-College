import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui';

export interface ReportPreview {
  format: 'pdf' | 'jpg';
  url: string;
  filename: string;
}

/**
 * Shows the generated report before it's saved to disk. The person can
 * check the data is right and close this to adjust filters and regenerate,
 * or confirm the download.
 */
export function ReportPreviewModal({
  preview,
  onClose,
  onDownload,
}: {
  preview: ReportPreview;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">Preview Report</h3>
            <p className="text-xs text-slate-500">Check the data before downloading. Close this to change filters and regenerate.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-4">
          {preview.format === 'pdf' ? (
            <iframe title="Report preview" src={preview.url} className="h-[70vh] w-full rounded-xl border border-slate-200 bg-white" />
          ) : (
            <img src={preview.url} alt="Report preview" className="mx-auto max-h-[70vh] rounded-xl border border-slate-200 bg-white object-contain" />
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">
          <Button variant="secondary" onClick={onClose}>Close &amp; Edit Filters</Button>
          <Button onClick={onDownload}><Download size={16} /> Download {preview.format.toUpperCase()}</Button>
        </div>
      </div>
    </div>
  );
}
