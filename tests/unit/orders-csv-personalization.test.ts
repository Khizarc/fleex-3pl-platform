// Unit tests for the CSV validator's personalization-column handling.
// Pure, no DB.

import { describe, expect, it } from 'vitest';
import {
  validateRows,
  type PersonalizationDefinition,
  type SkuLookup,
} from '@/features/orders/csv';

const skuLookup: SkuLookup = new Map([['ABC-1', { id: 'sku_abc1', name: 'Widget A' }]]);

function row(over: Record<string, string> = {}): Record<string, string> {
  return {
    order_reference: '',
    ship_to_name: 'Jane Doe',
    ship_to_line1: '123 Main St',
    ship_to_line2: '',
    ship_to_city: 'Brooklyn',
    ship_to_region: 'NY',
    ship_to_postal_code: '11201',
    ship_to_country: 'US',
    customer_note: '',
    sku_code: 'ABC-1',
    quantity: '1',
    ...over,
  };
}

const activeEngraving: PersonalizationDefinition = {
  id: 'field_engraving',
  key: 'engraving_text',
  required: false,
  status: 'ACTIVE',
};
const requiredEngraving: PersonalizationDefinition = {
  ...activeEngraving,
  required: true,
};
const disabledEngraving: PersonalizationDefinition = {
  ...activeEngraving,
  status: 'DISABLED',
};

describe('validateRows — personalization column happy path', () => {
  it('captures supplied personalization values onto the line', () => {
    const { orders, rowErrors } = validateRows(
      [row({ personalization_engraving_text: 'Happy Birthday' })],
      skuLookup,
      [activeEngraving],
    );
    expect(rowErrors).toEqual([]);
    expect(orders).toHaveLength(1);
    expect(orders[0]!.lines[0]!.personalization).toEqual({
      engraving_text: 'Happy Birthday',
    });
  });

  it('skips empty optional values — no personalization key on the line', () => {
    const { orders, rowErrors } = validateRows(
      [row({ personalization_engraving_text: '  ' })],
      skuLookup,
      [activeEngraving],
    );
    expect(rowErrors).toEqual([]);
    expect(orders[0]!.lines[0]!.personalization).toBeUndefined();
  });

  it('passes through when no definitions exist and no personalization columns are present', () => {
    const { orders, rowErrors } = validateRows([row()], skuLookup, []);
    expect(rowErrors).toEqual([]);
    expect(orders).toHaveLength(1);
  });
});

describe('validateRows — unknown personalization column', () => {
  it('flags rows with columns that do not match any definition', () => {
    const { orders, rowErrors } = validateRows(
      [row({ personalization_unknown_field: 'X' })],
      skuLookup,
      [activeEngraving],
    );
    expect(orders).toHaveLength(0);
    expect(rowErrors[0]!.message).toMatch(/Unknown personalization column/i);
  });
});

describe('validateRows — disabled-field column', () => {
  it('flags rows that include a column referring to a disabled field', () => {
    const { orders, rowErrors } = validateRows(
      [row({ personalization_engraving_text: 'X' })],
      skuLookup,
      [disabledEngraving],
    );
    expect(orders).toHaveLength(0);
    expect(rowErrors[0]!.message).toMatch(/disabled/i);
  });
});

describe('validateRows — required field missing', () => {
  it('flags rows missing a required personalization value', () => {
    const { orders, rowErrors } = validateRows([row()], skuLookup, [requiredEngraving]);
    expect(orders).toHaveLength(0);
    expect(rowErrors[0]!.message).toMatch(/Required personalization/i);
  });

  it('flags empty-string required values', () => {
    const { orders, rowErrors } = validateRows(
      [row({ personalization_engraving_text: '   ' })],
      skuLookup,
      [requiredEngraving],
    );
    expect(orders).toHaveLength(0);
    expect(rowErrors[0]!.message).toMatch(/Required personalization/i);
  });
});

describe('validateRows — value length cap', () => {
  it('flags personalization values exceeding 500 chars', () => {
    const long = 'a'.repeat(501);
    const { orders, rowErrors } = validateRows(
      [row({ personalization_engraving_text: long })],
      skuLookup,
      [activeEngraving],
    );
    expect(orders).toHaveLength(0);
    expect(rowErrors[0]!.message).toMatch(/500/);
  });
});

describe('validateRows — grouped order, per-row personalization', () => {
  it('attaches different personalization values to each line in the same group', () => {
    const rows = [
      row({
        order_reference: 'PO-1',
        sku_code: 'ABC-1',
        personalization_engraving_text: 'Line A',
      }),
      row({
        order_reference: 'PO-1',
        sku_code: 'ABC-1', // duplicate SKU triggers a different error; use diff
      }),
    ];
    // Override second row's SKU so the group doesn't fail dedup
    rows[1]!.sku_code = 'ABC-2';
    skuLookup.set('ABC-2', { id: 'sku_abc2', name: 'B' });
    rows[1]!.personalization_engraving_text = 'Line B';

    const { orders, rowErrors } = validateRows(rows, skuLookup, [activeEngraving]);
    expect(rowErrors).toEqual([]);
    expect(orders).toHaveLength(1);
    expect(orders[0]!.lines).toHaveLength(2);
    expect(orders[0]!.lines[0]!.personalization).toEqual({ engraving_text: 'Line A' });
    expect(orders[0]!.lines[1]!.personalization).toEqual({ engraving_text: 'Line B' });
    // Cleanup the SKU lookup so it doesn't leak across tests in this file
    skuLookup.delete('ABC-2');
  });
});
