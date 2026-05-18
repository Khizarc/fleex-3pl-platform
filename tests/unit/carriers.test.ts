// Unit tests for lib/carriers.ts — pure tracking-URL map + display name.

import { describe, expect, it } from 'vitest';
import { Carrier } from '@prisma/client';
import { carrierDisplayName, carrierTrackingUrl } from '@/lib/carriers';

describe('carrierTrackingUrl', () => {
  it('USPS produces a tracking URL', () => {
    const fn = carrierTrackingUrl.USPS!;
    expect(fn('9405511899223197428490')).toContain('tools.usps.com');
    expect(fn('9405511899223197428490')).toContain('9405511899223197428490');
  });
  it('UPS produces a tracking URL', () => {
    const fn = carrierTrackingUrl.UPS!;
    expect(fn('1Z999')).toContain('ups.com');
    expect(fn('1Z999')).toContain('1Z999');
  });
  it('FEDEX produces a tracking URL', () => {
    const fn = carrierTrackingUrl.FEDEX!;
    expect(fn('123456789012')).toContain('fedex.com');
  });
  it('DHL produces a tracking URL', () => {
    const fn = carrierTrackingUrl.DHL!;
    expect(fn('ABC123')).toContain('dhl.com');
  });
  it('OTHER returns null', () => {
    expect(carrierTrackingUrl.OTHER).toBeNull();
  });
  it('encodes tracking numbers safely', () => {
    const fn = carrierTrackingUrl.USPS!;
    expect(fn('with space')).toContain('with%20space');
  });
});

describe('carrierDisplayName', () => {
  it('returns friendly names for known carriers', () => {
    expect(carrierDisplayName(Carrier.USPS, null)).toBe('USPS');
    expect(carrierDisplayName(Carrier.UPS, null)).toBe('UPS');
    expect(carrierDisplayName(Carrier.FEDEX, null)).toBe('FedEx');
    expect(carrierDisplayName(Carrier.DHL, null)).toBe('DHL');
  });
  it('uses carrierOther for OTHER when present', () => {
    expect(carrierDisplayName(Carrier.OTHER, 'Custom Courier')).toBe('Custom Courier');
  });
  it('falls back to "Other" if carrierOther is empty', () => {
    expect(carrierDisplayName(Carrier.OTHER, '')).toBe('Other');
    expect(carrierDisplayName(Carrier.OTHER, null)).toBe('Other');
  });
  it('ignores carrierOther for known carriers (defensive)', () => {
    expect(carrierDisplayName(Carrier.USPS, 'should not show')).toBe('USPS');
  });
});
