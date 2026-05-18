// Unit tests for the CSV parser. Pure, no DB.

import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/features/orders/csv';

describe('parseCsv — header normalization', () => {
  it('normalizes Title Case headers to snake_case lowercase', () => {
    const csv = `Order Reference,Ship To Name,Quantity
PO-1,Jane,3`;
    const { rows } = parseCsv(csv);
    expect(rows[0]).toMatchObject({
      order_reference: 'PO-1',
      ship_to_name: 'Jane',
      quantity: '3',
    });
  });

  it('normalizes mixed-case + hyphenated headers', () => {
    const csv = `SKU-Code,Ship-To-City
ABC-1,Brooklyn`;
    const { rows } = parseCsv(csv);
    expect(rows[0]).toMatchObject({ sku_code: 'ABC-1', ship_to_city: 'Brooklyn' });
  });
});

describe('parseCsv — cell trimming', () => {
  it('trims leading and trailing whitespace on every cell', () => {
    const csv = `sku_code,quantity
  ABC-1  , 3 `;
    const { rows } = parseCsv(csv);
    expect(rows[0]).toMatchObject({ sku_code: 'ABC-1', quantity: '3' });
  });
});

describe('parseCsv — UTF-8 BOM (Excel)', () => {
  it('strips the BOM from the first header so header normalization still matches', () => {
    const bom = '﻿';
    const csv = `${bom}order_reference,sku_code
PO-1,ABC-1`;
    const { rows } = parseCsv(csv);
    expect(rows[0]).toMatchObject({ order_reference: 'PO-1', sku_code: 'ABC-1' });
  });
});

describe('parseCsv — empty rows', () => {
  it('skips fully blank rows (greedy)', () => {
    const csv = `sku_code,quantity
ABC-1,3

ABC-2,4
`;
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
  });
});

describe('parseCsv — CRLF line endings (Excel default)', () => {
  it('handles \\r\\n correctly', () => {
    const csv = 'sku_code,quantity\r\nABC-1,3\r\nABC-2,5\r\n';
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ sku_code: 'ABC-2', quantity: '5' });
  });
});
