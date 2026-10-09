/**
 * VendorToggles.tsx — optional vendor inclusion switches (BACKLOG A-06).
 *
 * Permutive (SDA), Identity modules, and IAS are each optional. Toggling one
 * removes its node from the canvas, removes its auction phase from the timeline,
 * and changes the resulting bids — the effect is visible everywhere at once.
 */

import { Fingerprint, Tags, Video } from 'lucide-react';

import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { roleStyle } from '@/lib/roleStyles';
import type { AuctionConfig } from '@/types';

export interface VendorTogglesProps {
  config: AuctionConfig;
  onChange: (patch: Partial<AuctionConfig>) => void;
}

interface VendorDefinition {
  key: 'includeAudience' | 'includeIdentity' | 'includeVerification';
  label: string;
  category: 'audience' | 'identity' | 'verification';
  effect: string;
}

const VENDORS: VendorDefinition[] = [
  {
    key: 'includeAudience',
    label: 'Permutive — Seller-Defined Audiences',
    category: 'audience',
    effect: 'Adds on-device cohorts to ortb2.user.data and lifts bid value.',
  },
  {
    key: 'includeIdentity',
    label: 'Identity modules — RampID / SharedID',
    category: 'identity',
    effect: 'Resolves pseudonymous envelope IDs for frequency capping.',
  },
  {
    key: 'includeVerification',
    label: 'IAS — Measurement & Verification',
    category: 'verification',
    effect: 'Adds a post-bid verification phase after the ad renders.',
  },
];

export function VendorToggles({ config, onChange }: VendorTogglesProps) {
  return (
    <section aria-label="Optional vendors and modules" className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Optional vendors & modules
      </h3>

      <ul className="space-y-2">
        {VENDORS.map((vendor) => {
          const checked = config[vendor.key];
          const style = roleStyle(vendor.category);
          const Icon =
            vendor.category === 'audience' ? Tags : vendor.category === 'identity' ? Fingerprint : Video;

          return (
            <li
              key={vendor.key}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5"
            >
              <div className="flex min-w-0 gap-2.5">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: style.hex }} aria-hidden="true" />
                <div className="min-w-0">
                  <label
                    htmlFor={`vendor-${vendor.key}`}
                    className="block cursor-pointer text-xs font-medium text-slate-200"
                  >
                    {vendor.label}
                  </label>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{vendor.effect}</p>
                </div>
              </div>

              <Switch
                id={`vendor-${vendor.key}`}
                checked={checked}
                onCheckedChange={(value) => onChange({ [vendor.key]: value })}
                aria-label={`${checked ? 'Exclude' : 'Include'} ${vendor.label}`}
                data-testid={`vendor-${vendor.key}`}
                className="shrink-0"
              />
            </li>
          );
        })}
      </ul>

      <Separator />

      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
        <div>
          <label htmlFor="consent-toggle" className="block cursor-pointer text-xs font-medium text-slate-200">
            TCF v2.2 consent granted
          </label>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Withdrawing consent drops every bidder that requires purpose 1.
          </p>
        </div>
        <Switch
          id="consent-toggle"
          checked={config.gdprConsent}
          onCheckedChange={(value) => onChange({ gdprConsent: value })}
          aria-label={config.gdprConsent ? 'Withdraw TCF consent' : 'Grant TCF consent'}
          data-testid="consent-toggle"
          className="shrink-0"
        />
      </div>
    </section>
  );
}