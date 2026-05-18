// Unit conversions for box dimensions + weight (Milestone 1.9).
//
// Pack form accepts inches + ounces (US 3PL convention). Storage is mm + g
// (integers; no float drift; EasyPost-friendly). Conversion happens at the
// form-submit boundary so the rest of the codebase works in canonical units.
//
// Rounding policy: `Math.round` to the nearest integer. EasyPost rate APIs
// are weight-tier-based; ±1g never crosses a tier in practice.

const MM_PER_INCH = 25.4;
const GRAMS_PER_OUNCE = 28.3495;

export function inchesToMm(inches: number): number {
  return Math.round(inches * MM_PER_INCH);
}

export function ouncesToGrams(ounces: number): number {
  return Math.round(ounces * GRAMS_PER_OUNCE);
}

// Reverse helpers — used by display code that wants to round-trip stored
// canonical units back to the imperial UI. Returns floats; the caller
// formats for display.
export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

export function gramsToOunces(grams: number): number {
  return grams / GRAMS_PER_OUNCE;
}
