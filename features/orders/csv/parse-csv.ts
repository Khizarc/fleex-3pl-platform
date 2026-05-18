// Isomorphic CSV parser. Works in both the browser (File input) and Node
// (vitest unit tests). Wraps papaparse with header normalization + cell trim.
//
// We deliberately keep this thin and let `validate-rows.ts` own all
// semantic validation. The parser's job is just: bytes → rows of strings.

import Papa from 'papaparse';

export type ParsedCsv = {
  rows: Record<string, string>[];
  parseErrors: { row: number; message: string }[];
};

// Normalize a header cell: trim, lowercase, collapse whitespace to `_`.
// Anything that papaparse can't normalize is preserved so we can still flag
// "unrecognized column" errors downstream if we ever decide to enforce it.
function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

// Trim every cell. papaparse already strips UTF-8 BOM by default. Empty
// strings are preserved (validator decides whether each field is required).
function transformCell(value: string): string {
  return typeof value === 'string' ? value.trim() : value;
}

export function parseCsv(input: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader,
    transform: transformCell,
    dynamicTyping: false,
  });

  return {
    rows: result.data,
    parseErrors: result.errors.map((e) => ({
      // papaparse `row` is the data-row index (0-based, header row excluded).
      // We emit 1-based line numbers including the header row for user
      // friendliness: data-row 0 → "line 2".
      row: typeof e.row === 'number' ? e.row + 2 : 0,
      message: e.message,
    })),
  };
}
