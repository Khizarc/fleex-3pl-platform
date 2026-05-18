// Unit tests for the personalization-field zod schemas. Pure, no DB.

import { describe, expect, it } from 'vitest';
import {
  createPersonalizationFieldSchema,
  updatePersonalizationFieldSchema,
  PERSONALIZATION_KEY_REGEX,
} from '@/features/personalization';

describe('createPersonalizationFieldSchema — key regex', () => {
  const goodKeys = ['engraving_text', 'monogram', 'gift_note', 'a', 'a1', 'a_b_c123'];
  const badKeys = [
    '',
    'Engraving',
    'engraving-text',
    '1engraving',
    '_engraving',
    'engraving text',
    'A'.repeat(60),
    'with.dot',
  ];

  for (const key of goodKeys) {
    it(`accepts ${JSON.stringify(key)}`, () => {
      expect(PERSONALIZATION_KEY_REGEX.test(key)).toBe(true);
      const result = createPersonalizationFieldSchema.safeParse({ key, label: 'L' });
      expect(result.success).toBe(true);
    });
  }
  for (const key of badKeys) {
    it(`rejects ${JSON.stringify(key)}`, () => {
      const result = createPersonalizationFieldSchema.safeParse({ key, label: 'L' });
      expect(result.success).toBe(false);
    });
  }
});

describe('createPersonalizationFieldSchema — defaults', () => {
  it('required defaults to false', () => {
    const r = createPersonalizationFieldSchema.parse({ key: 'k', label: 'L' });
    expect(r.required).toBe(false);
  });
  it('sortOrder defaults to 0', () => {
    const r = createPersonalizationFieldSchema.parse({ key: 'k', label: 'L' });
    expect(r.sortOrder).toBe(0);
  });
});

describe('createPersonalizationFieldSchema — caps', () => {
  it('rejects empty label', () => {
    const r = createPersonalizationFieldSchema.safeParse({ key: 'k', label: '' });
    expect(r.success).toBe(false);
  });
  it('rejects label over 120 chars', () => {
    const r = createPersonalizationFieldSchema.safeParse({
      key: 'k',
      label: 'a'.repeat(121),
    });
    expect(r.success).toBe(false);
  });
  it('rejects description over 500 chars', () => {
    const r = createPersonalizationFieldSchema.safeParse({
      key: 'k',
      label: 'L',
      description: 'a'.repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe('updatePersonalizationFieldSchema', () => {
  it('does NOT accept `key` (zod strips unknown keys by default — additional test below ensures behavior)', () => {
    // Zod object() strips unknown keys silently. Confirming it doesn't surface
    // a `key` field on the parsed result is the relevant guarantee for the
    // service layer (which deliberately does not pass `key` into update()).
    const parsed = updatePersonalizationFieldSchema.parse({
      key: 'attempted_change',
      label: 'New label',
    } as Record<string, unknown>);
    expect((parsed as Record<string, unknown>).key).toBeUndefined();
    expect(parsed.label).toBe('New label');
  });

  it('allows updating individual fields independently', () => {
    expect(updatePersonalizationFieldSchema.safeParse({}).success).toBe(true);
    expect(updatePersonalizationFieldSchema.safeParse({ required: true }).success).toBe(true);
    expect(updatePersonalizationFieldSchema.safeParse({ sortOrder: 5 }).success).toBe(true);
  });
});
