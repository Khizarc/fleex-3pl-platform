// Validate + group parsed CSV rows.
//
// Pure function — no DB, no I/O. Takes raw rows + a SKU lookup map + an
// (optional) personalization-field definitions list and produces:
//   - `orders`: grouped, validated, ready to feed to bulkCreateOrders
//   - `rowErrors`: per-row problems with 1-based line numbers
//
// Grouping rule: rows sharing the same non-blank `order_reference` collapse
// into one multi-line order. Rows with blank reference each become their
// own single-line order (groupKey = synthetic `__row_<n>`).
//
// Cross-row consistency: all rows in one group must share identical
// ship-to fields. Mismatch → the WHOLE group is rejected (with one error
// pointing at the first divergent row).
//
// Personalization columns (1.7): any raw column matching
// `personalization_<key>` is recognized; suffixes are validated against
// the supplied `definitions` list. Unknown / DISABLED keys → row error.
// Missing required values → row error. Empty optional values are dropped
// (matches createOrder semantics).

import { csvOrderRowSchema, type CsvOrderRow } from './schema';

export type SkuLookup = Map<string, { id: string; name: string } | null>;

export type PersonalizationDefinition = {
  id: string;
  key: string;
  required: boolean;
  // status drives the disabled-column-warns-instead-of-silently-dropping rule
  status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
};

export type GroupedOrderLine = {
  skuId: string;
  skuCode: string;
  quantity: number;
  personalization?: Record<string, string>;
};

export type GroupedOrder = {
  groupKey: string;
  rowNumbers: number[];
  shipTo: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  customerNote?: string;
  lines: GroupedOrderLine[];
};

export type RowError = {
  row: number;
  groupKey?: string;
  message: string;
};

export type ValidateResult = {
  orders: GroupedOrder[];
  rowErrors: RowError[];
};

export type ValidateCaps = {
  maxRows: number;
};

export const DEFAULT_CAPS: ValidateCaps = { maxRows: 1000 };

const PERSONALIZATION_COLUMN_PREFIX = 'personalization_';

export function validateRows(
  rawRows: Record<string, string>[],
  skuLookup: SkuLookup,
  definitions: PersonalizationDefinition[] = [],
  caps: ValidateCaps = DEFAULT_CAPS,
): ValidateResult {
  if (rawRows.length > caps.maxRows) {
    return {
      orders: [],
      rowErrors: [
        {
          row: 0,
          message: `CSV has ${rawRows.length} rows; the limit is ${caps.maxRows}. Split the file and try again.`,
        },
      ],
    };
  }

  const defsByKey = new Map(definitions.map((d) => [d.key, d]));
  const activeRequiredKeys = definitions
    .filter((d) => d.status === 'ACTIVE' && d.required)
    .map((d) => d.key);

  type ParsedRow = {
    lineNumber: number;
    data: CsvOrderRow;
    personalization: Record<string, string>;
  };
  const parsedByGroup = new Map<string, ParsedRow[]>();
  const rowErrors: RowError[] = [];

  rawRows.forEach((rawRow, idx) => {
    const lineNumber = idx + 2; // 1-based, includes header row at line 1
    const result = csvOrderRowSchema.safeParse(rawRow);
    if (!result.success) {
      rowErrors.push({
        row: lineNumber,
        message: result.error.issues
          .map((issue) => `${issue.path.join('.') || 'row'}: ${issue.message}`)
          .join('; '),
      });
      return;
    }

    // Extract personalization columns from the raw row (the strict zod schema
    // would have dropped them otherwise).
    const personalization: Record<string, string> = {};
    let columnError: string | null = null;
    for (const [rawKey, rawValue] of Object.entries(rawRow)) {
      if (!rawKey.startsWith(PERSONALIZATION_COLUMN_PREFIX)) continue;
      const fieldKey = rawKey.slice(PERSONALIZATION_COLUMN_PREFIX.length);
      const def = defsByKey.get(fieldKey);
      if (!def) {
        columnError = `Unknown personalization column "${rawKey}". Remove it or define the field first.`;
        break;
      }
      if (def.status !== 'ACTIVE') {
        columnError = `Personalization column "${rawKey}" refers to a disabled field. Remove it.`;
        break;
      }
      const value = (rawValue ?? '').trim();
      if (value.length === 0) continue; // optional empty → skip
      if (value.length > 500) {
        columnError = `Personalization "${rawKey}" exceeds 500 characters.`;
        break;
      }
      personalization[fieldKey] = value;
    }
    if (columnError) {
      rowErrors.push({ row: lineNumber, message: columnError });
      return;
    }

    // Required-field check per row (per-line scope, so each row must carry
    // its own values).
    const missing = activeRequiredKeys.find(
      (k) => !personalization[k] || personalization[k]!.trim().length === 0,
    );
    if (missing) {
      rowErrors.push({
        row: lineNumber,
        message: `Required personalization "${missing}" is missing.`,
      });
      return;
    }

    const data = result.data;
    const groupKey = data.order_reference || `__row_${lineNumber}`;
    const bucket = parsedByGroup.get(groupKey);
    if (bucket) {
      bucket.push({ lineNumber, data, personalization });
    } else {
      parsedByGroup.set(groupKey, [{ lineNumber, data, personalization }]);
    }
  });

  const orders: GroupedOrder[] = [];

  for (const [groupKey, group] of parsedByGroup) {
    const first = group[0]!.data;

    const inconsistent = group.find((r) => !shipToMatches(r.data, first));
    if (inconsistent) {
      rowErrors.push({
        row: inconsistent.lineNumber,
        groupKey,
        message: `Ship-to fields don't match other rows for order_reference "${groupKey}".`,
      });
      continue;
    }

    const seenSkus = new Set<string>();
    let duplicateSku: { lineNumber: number; sku: string } | null = null;
    for (const r of group) {
      if (seenSkus.has(r.data.sku_code)) {
        duplicateSku = { lineNumber: r.lineNumber, sku: r.data.sku_code };
        break;
      }
      seenSkus.add(r.data.sku_code);
    }
    if (duplicateSku) {
      rowErrors.push({
        row: duplicateSku.lineNumber,
        groupKey,
        message: `SKU "${duplicateSku.sku}" appears more than once in order "${groupKey}". Combine the quantities into a single line.`,
      });
      continue;
    }

    const unresolved = group.find((r) => !skuLookup.get(r.data.sku_code));
    if (unresolved) {
      rowErrors.push({
        row: unresolved.lineNumber,
        groupKey,
        message: `SKU "${unresolved.data.sku_code}" not found in this client's catalog.`,
      });
      continue;
    }

    orders.push({
      groupKey,
      rowNumbers: group.map((r) => r.lineNumber),
      shipTo: {
        name: first.ship_to_name,
        line1: first.ship_to_line1,
        line2: first.ship_to_line2 || undefined,
        city: first.ship_to_city,
        region: first.ship_to_region,
        postalCode: first.ship_to_postal_code,
        country: first.ship_to_country,
      },
      customerNote: first.customer_note || undefined,
      lines: group.map((r) => {
        const sku = skuLookup.get(r.data.sku_code)!;
        const line: GroupedOrderLine = {
          skuId: sku!.id,
          skuCode: r.data.sku_code,
          quantity: r.data.quantity,
        };
        if (Object.keys(r.personalization).length > 0) {
          line.personalization = r.personalization;
        }
        return line;
      }),
    });
  }

  return { orders, rowErrors };
}

function shipToMatches(a: CsvOrderRow, b: CsvOrderRow): boolean {
  return (
    a.ship_to_name === b.ship_to_name &&
    a.ship_to_line1 === b.ship_to_line1 &&
    a.ship_to_line2 === b.ship_to_line2 &&
    a.ship_to_city === b.ship_to_city &&
    a.ship_to_region === b.ship_to_region &&
    a.ship_to_postal_code === b.ship_to_postal_code &&
    a.ship_to_country === b.ship_to_country
  );
}
