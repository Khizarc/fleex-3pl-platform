// Validate + group parsed CSV rows.
//
// Pure function — no DB, no I/O. Takes raw rows + a SKU lookup map (the
// caller resolved SKU codes to {id,name} via the tenant-scoped server
// action) and produces:
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

import { csvOrderRowSchema, type CsvOrderRow } from './schema';

export type SkuLookup = Map<string, { id: string; name: string } | null>;

export type GroupedOrder = {
  groupKey: string; // user-supplied order_reference, or synthetic "__row_N"
  rowNumbers: number[]; // 1-based line numbers (including header), for UX
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
  lines: { skuId: string; skuCode: string; quantity: number }[];
};

export type RowError = {
  row: number; // 1-based line number including header
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

export function validateRows(
  rawRows: Record<string, string>[],
  skuLookup: SkuLookup,
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

  type ParsedRow = { lineNumber: number; data: CsvOrderRow };
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

    const data = result.data;
    const groupKey = data.order_reference || `__row_${lineNumber}`;
    const bucket = parsedByGroup.get(groupKey);
    if (bucket) {
      bucket.push({ lineNumber, data });
    } else {
      parsedByGroup.set(groupKey, [{ lineNumber, data }]);
    }
  });

  const orders: GroupedOrder[] = [];

  for (const [groupKey, group] of parsedByGroup) {
    const first = group[0]!.data;

    // Ship-to consistency check across all rows in the group.
    const inconsistent = group.find((r) => !shipToMatches(r.data, first));
    if (inconsistent) {
      rowErrors.push({
        row: inconsistent.lineNumber,
        groupKey,
        message: `Ship-to fields don't match other rows for order_reference "${groupKey}".`,
      });
      continue;
    }

    // Per-order SKU uniqueness check (same SKU twice in one group is a user
    // mistake — should have summed the quantities).
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

    // SKU resolution check (lookup performed by the caller; we just consume).
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
        return {
          skuId: sku!.id,
          skuCode: r.data.sku_code,
          quantity: r.data.quantity,
        };
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
