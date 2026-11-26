/**
 * OpenRTBInspector.tsx — OpenRTB 2.5 BidRequest / BidResponse inspector (F-04).
 *
 * Renders the raw JSON of the last request and response with collapsible
 * sections and a Zod validation badge (green = valid, red = invalid).
 */
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BidRequestSchema, BidResponseSchema, validatePayload } from '@/lib/openrtb';

export interface OpenRTBInspectorProps {
  request: unknown | null;
  response: unknown | null;
}

const SECTIONS = ['imp', 'site', 'user', 'regs', 'ext.prebid', 'seatbid'] as const;

function SectionView({ title, value }: { title: string; value: unknown }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded border border-slate-800">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800/50">
        <span>{title}</span>
        <span className="text-slate-500">{open ? '−' : '+'}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-slate-800 bg-slate-950/50 p-2">
        <pre className="overflow-auto font-mono text-[10px] text-slate-300" data-testid={`section-${title}`}>
          {JSON.stringify(value, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function OpenRTBInspector({ request, response }: OpenRTBInspectorProps) {
  const [tab, setTab] = useState<'request' | 'response'>('request');
  const reqValidation = request ? validatePayload(BidRequestSchema, request) : null;
  const resValidation = response ? validatePayload(BidResponseSchema, response) : null;

  const payload = tab === 'request' ? request : response;
  const validation = tab === 'request' ? reqValidation : resValidation;

  // Split payload into collapsible sections when possible.
  const sections: Array<{ title: string; value: unknown }> = [];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of SECTIONS) {
      if (key === 'ext.prebid') {
        const ext = obj.ext as Record<string, unknown> | undefined;
        const prebid = ext?.prebid;
        if (prebid !== undefined) sections.push({ title: 'ext.prebid', value: prebid });
      } else if (obj[key] !== undefined) {
        sections.push({ title: key, value: obj[key] });
      }
    }
    // Fallback: show whole payload if no known sections matched.
    if (sections.length === 0) {
      sections.push({ title: 'payload', value: payload });
    }
  }

  return (
    <section aria-label="OpenRTB inspector" className="space-y-2" data-testid="openrtb-inspector">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          OpenRTB Inspector
        </h3>
        {validation && (
          <Badge
            data-testid="validation-badge"
            className={validation.valid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}
          >
            {validation.valid ? 'valid' : 'invalid'}
          </Badge>
        )}
      </div>

      <div className="flex gap-1">
        <Button
          size="sm"
          variant={tab === 'request' ? 'default' : 'outline'}
          onClick={() => setTab('request')}
          data-testid="inspector-tab-request"
        >
          BidRequest
        </Button>
        <Button
          size="sm"
          variant={tab === 'response' ? 'default' : 'outline'}
          onClick={() => setTab('response')}
          data-testid="inspector-tab-response"
        >
          BidResponse
        </Button>
      </div>

      <div className="space-y-1">
        {sections.map((s) => (
          <SectionView key={s.title} title={s.title} value={s.value} />
        ))}
        {!payload && (
          <p className="text-[11px] text-slate-500">Run the auction to inspect payloads.</p>
        )}
      </div>

      {validation && !validation.valid && (
        <ul className="space-y-1 text-[10px] text-red-300" data-testid="validation-errors">
          {validation.errors.map((e, i) => (
            <li key={i}>
              {e.path}: {e.message}
            </li>
          ))}
        </ul>
      )}

      <pre className="hidden" data-testid="bidrequest-json">
        {request ? JSON.stringify(request) : ''}
      </pre>
      <pre className="hidden" data-testid="bidresponse-json">
        {response ? JSON.stringify(response) : ''}
      </pre>
    </section>
  );
}