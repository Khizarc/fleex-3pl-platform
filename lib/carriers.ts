// Carrier helpers (Milestone 1.10): pure tracking-URL map + display-name
// helper. Insulates the URL-drift risk — if a carrier changes their tracking
// URL format, one line of code fixes it everywhere.
//
// `OTHER` returns null for the URL helper; UI renders the tracking number as
// plain text. `carrierDisplayName` uses `carrierOther` for the OTHER row's
// label so the user sees the actual carrier name (e.g. "Custom Courier")
// instead of just "OTHER".

import { Carrier } from '@prisma/client';

export const carrierTrackingUrl: Record<Carrier, ((tracking: string) => string) | null> = {
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  UPS: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  FEDEX: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  DHL: (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(n)}`,
  OTHER: null,
};

const FRIENDLY_NAMES: Record<Carrier, string> = {
  USPS: 'USPS',
  UPS: 'UPS',
  FEDEX: 'FedEx',
  DHL: 'DHL',
  OTHER: 'Other',
};

export function carrierDisplayName(carrier: Carrier, carrierOther: string | null): string {
  if (carrier === Carrier.OTHER) {
    return carrierOther && carrierOther.trim().length > 0 ? carrierOther : FRIENDLY_NAMES.OTHER;
  }
  return FRIENDLY_NAMES[carrier];
}
