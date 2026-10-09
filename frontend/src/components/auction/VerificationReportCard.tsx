/**
 * VerificationReportCard.tsx — IAS post-bid verification report (BACKLOG A-07).
 *
 * Only rendered when the IAS optional vendor is enabled, and every metric is
 * derived from the winning CPM by `deriveVerificationReport()` rather than
 * hardcoded, so the numbers move when the auction configuration changes.
 */

import { Eye, ShieldCheck, TriangleAlert } from 'lucide-react';

import type { VerificationReport } from '@/types';

export interface VerificationReportCardProps {
  report: VerificationReport;
}

export function VerificationReportCard({ report }: VerificationReportCardProps) {
  return (
    <section
      className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3"
      aria-label="Post-bid verification report"
      data-testid="verification-report"
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {report.vendor} Measurement
        </h3>
        <span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] uppercase text-rose-200">
          Post-bid verified
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-slate-500">Viewability</dt>
          <dd
            className={`mt-0.5 font-mono text-sm font-semibold ${report.viewabilityScore >= 70 ? 'text-emerald-300' : 'text-amber-300'}`}
            data-testid="metric-viewability"
          >
            {report.viewabilityScore}%
          </dd>
          <dd className="text-[10px] text-slate-500">{report.viewable ? 'In view' : 'Not viewable'}</dd>
        </div>

        <div>
          <dt className="text-[10px] uppercase tracking-wider text-slate-500">IVT rate</dt>
          <dd
            className={`mt-0.5 font-mono text-sm font-semibold ${report.ivtClassification === 'CLEAN' ? 'text-emerald-300' : 'text-red-300'}`}
            data-testid="metric-ivt"
          >
            {report.ivtRate}%
          </dd>
          <dd className="text-[10px] text-slate-500" data-testid="metric-ivt-classification">
            {report.ivtClassification}
          </dd>
        </div>

        <div>
          <dt className="text-[10px] uppercase tracking-wider text-slate-500">Brand safety</dt>
          <dd
            className={`mt-0.5 font-mono text-sm font-semibold ${report.brandSafetyStatus === 'SAFE' ? 'text-emerald-300' : 'text-amber-300'}`}
            data-testid="metric-brand-safety"
          >
            {report.brandSafetyStatus}
          </dd>
          <dd className="flex items-center gap-1 text-[10px] text-slate-500">
            {report.brandSafetyStatus === 'SAFE' ? (
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TriangleAlert className="h-3 w-3" aria-hidden="true" />
            )}
            {report.measurementStandard}
          </dd>
        </div>
      </dl>

      <p className="mt-2.5 text-[10px] leading-relaxed text-slate-500">
        Synthetic measurement produced by a mocked endpoint. No creative is fetched and no verification
        vendor is contacted.
      </p>
    </section>
  );
}