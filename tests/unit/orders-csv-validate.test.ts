// Unit tests for the row validator + grouper. Pure, no DB.

import { describe, expect, it } from 'vitest';
import { validateRows, type SkuLookup } from '@/features/orders/csv';

// Fixture: a SKU lookup that knows about two SKUs in the caller's catalog.
const skuLookup: SkuLookup = new Map([
  ['ABC-1', { id: 'sku_abc1', name: 'Widget A' }],
  ['ABC-2', { id: 'sku_abc2', name: 'Widget B' }],
]);

// Convenience: a row of well-formed string values.
function row(over: Record<string, string> = {}): Record<string, string> {
  return {
    order_reference: '',
    ship_to_name: 'Jane Doe',
    ship_to_line1: '123 Main St',
    ship_to_line2: '',
    ship_to_city: 'Brooklyn',
    ship_to_region: 'NY',
    ship_to_postal_code: '11201',
    ship_to_country: 'us', // lowercase to exercise normalization
    customer_note: '',
    sku_code: 'ABC-1',
    quantity: '3',
    ...over,
  };
}

describe('validateRows — happy path', () => {
  it('one row → one order, country uppercased', () => {
    const { orders, rowErrors } = validateRows([row()], skuLookup);
    expect(rowErrors).toEqual([]);
    expect(orders).toHaveLength(1);
    expect(orders[0]!.shipTo.country).toBe('US');
    expect(orders[0]!.lines).toEqual([{ skuId: 'sku_abc1', skuCode: 'ABC-1', quantity: 3 }]);
  });

  it('three rows sharing order_reference group into one multi-line order', () => {
    const rows = [
      row({ order_reference: 'PO-1', sku_code: 'ABC-1', quantity: '3' }),
      row({ order_reference: 'PO-1', sku_code: 'ABC-2', quantity: '4' }),
    ];
    const { orders, rowErrors } = validateRows(rows, skuLookup);
    expect(rowErrors).toEqual([]);
    expect(orders).toHaveLength(1);
    expect(orders[0]!.lines).toHaveLength(2);
    expect(orders[0]!.groupKey).toBe('PO-1');
  });

  it('rows with blank reference each become their own order', () => {
    const rows = [
      row({ sku_code: 'ABC-1', quantity: '2' }),
      row({ sku_code: 'ABC-2', quantity: '5' }),
    ];
    const { orders, rowErrors } = validateRows(rows, skuLookup);
    expect(rowErrors).toEqual([]);
    expect(orders).toHaveLength(2);
  });
});

describe('validateRows — quantity coercion', () => {
  it('rejects non-numeric quantity', () => {
    const { orders, rowErrors } = validateRows([row({ quantity: 'three' })], skuLookup);
    expect(orders).toHaveLength(0);
    expect(rowErrors[0]!.message).toMatch(/quantity/i);
  });

  it('rejects zero quantity', () => {
    const { rowErrors } = validateRows([row({ quantity: '0' })], skuLookup);
    expect(rowErrors[0]!.message).toMatch(/greater than zero/i);
  });

  it('rejects non-integer quantity', () => {
    const { rowErrors } = validateRows([row({ quantity: '1.5' })], skuLookup);
    expect(rowErrors[0]!.message).toMatch(/whole number/i);
  });
});

describe('validateRows — required fields', () => {
  it('flags missing ship_to_name', () => {
    const { rowErrors } = validateRows([row({ ship_to_name: '' })], skuLookup);
    expect(rowErrors[0]!.message).toMatch(/recipient name/i);
  });

  it('flags bad country code length', () => {
    const { rowErrors } = validateRows([row({ ship_to_country: 'USA' })], skuLookup);
    expect(rowErrors[0]!.message).toMatch(/2-letter/i);
  });
});

describe('validateRows — cross-row consistency in a group', () => {
  it('rejects the whole group if ship-to differs across rows', () => {
    const rows = [
      row({ order_reference: 'PO-1', sku_code: 'ABC-1' }),
      row({ order_reference: 'PO-1', sku_code: 'ABC-2', ship_to_city: 'Queens' }),
    ];
    const { orders, rowErrors } = validateRows(rows, skuLookup);
    expect(orders).toHaveLength(0);
    expect(rowErrors[0]!.message).toMatch(/ship-to/i);
  });

  it('rejects the group if the same SKU appears twice', () => {
    const rows = [
      row({ order_reference: 'PO-1', sku_code: 'ABC-1', quantity: '2' }),
      row({ order_reference: 'PO-1', sku_code: 'ABC-1', quantity: '3' }),
    ];
    const { orders, rowErrors } = validateRows(rows, skuLookup);
    expect(orders).toHaveLength(0);
    expect(rowErrors[0]!.message).toMatch(/more than once/i);
  });
});

describe('validateRows — unresolved SKU', () => {
  it('rejects the group if any SKU is not in the lookup', () => {
    const rows = [
      row({ order_reference: 'PO-1', sku_code: 'ABC-1' }),
      row({ order_reference: 'PO-1', sku_code: 'UNKNOWN' }),
    ];
    const { orders, rowErrors } = validateRows(rows, skuLookup);
    expect(orders).toHaveLength(0);
    expect(rowErrors[0]!.message).toMatch(/not found/i);
  });
});

describe('validateRows — row count cap', () => {
  it('rejects the entire file if rows exceed the cap', () => {
    const rows = Array.from({ length: 3 }, () => row());
    const { orders, rowErrors } = validateRows(rows, skuLookup, { maxRows: 2 });
    expect(orders).toHaveLength(0);
    expect(rowErrors).toHaveLength(1);
    expect(rowErrors[0]!.message).toMatch(/limit is 2/);
  });
});

describe('validateRows — line numbers', () => {
  it('row error reports a 1-based line number including the header row', () => {
    // Row index 0 → line 2 (line 1 is the header).
    const { rowErrors } = validateRows([row({ quantity: 'bad' })], skuLookup);
    expect(rowErrors[0]!.row).toBe(2);
  });
});
