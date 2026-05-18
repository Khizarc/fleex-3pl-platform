// Unit tests for the inches↔mm and ounces↔grams helpers (Milestone 1.9).
// Pure. No DB.

import { describe, expect, it } from 'vitest';
import { gramsToOunces, inchesToMm, mmToInches, ouncesToGrams } from '@/features/orders/units';

describe('inchesToMm', () => {
  it('1 in → 25 mm (Math.round of 25.4)', () => {
    expect(inchesToMm(1)).toBe(25);
  });
  it('10 in → 254 mm', () => {
    expect(inchesToMm(10)).toBe(254);
  });
  it('0.5 in → 13 mm (Math.round of 12.7)', () => {
    expect(inchesToMm(0.5)).toBe(13);
  });
  it('handles realistic box dimension (12 in cube)', () => {
    expect(inchesToMm(12)).toBe(305);
  });
  it('big box: 96 in → 2438 mm (close to 3 m cap)', () => {
    expect(inchesToMm(96)).toBe(2438);
  });
});

describe('ouncesToGrams', () => {
  it('1 oz → 28 g (Math.round of 28.3495)', () => {
    expect(ouncesToGrams(1)).toBe(28);
  });
  it('5.5 oz → 156 g (Math.round of 155.92)', () => {
    expect(ouncesToGrams(5.5)).toBe(156);
  });
  it('0.5 oz → 14 g (Math.round of 14.175)', () => {
    expect(ouncesToGrams(0.5)).toBe(14);
  });
  it('16 oz (1 lb) → 454 g', () => {
    expect(ouncesToGrams(16)).toBe(454);
  });
  it('large box: 240 oz (15 lb) → 6804 g', () => {
    expect(ouncesToGrams(240)).toBe(6804);
  });
});

describe('reverse helpers (display only — returns floats)', () => {
  it('mmToInches(254) ≈ 10', () => {
    expect(mmToInches(254)).toBeCloseTo(10, 4);
  });
  it('gramsToOunces(454) ≈ 16.0144', () => {
    expect(gramsToOunces(454)).toBeCloseTo(16.01, 1);
  });
});
