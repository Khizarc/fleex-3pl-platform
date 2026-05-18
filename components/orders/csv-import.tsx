'use client';

// Shared CSV import client component (Milestone 1.6).
//
// Pure UI logic: file pick → client-side parse → resolve SKUs (server) →
// validate (client) → preview → submit (server) → results panel.
//
// Server actions are injected by the shell wrappers so this component
// doesn't know whether it's portal or staff.

import { useState, useTransition, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Download, FileUp, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  parseCsv,
  validateRows,
  CSV_HEADERS,
  type GroupedOrder,
  type RowError,
  type SkuLookup,
  type BulkCreateOrdersResult,
} from '@/features/orders';

const MAX_FILE_BYTES = 2_000_000;

export type ResolveSkusFn = (
  codes: string[],
) => Promise<Record<string, { id: string; name: string } | null>>;

export type ImportOrdersFn = (
  orders: GroupedOrder[],
) => Promise<{ ok: true; data: BulkCreateOrdersResult } | { ok: false; error: string }>;

type Phase =
  | { kind: 'idle' }
  | { kind: 'parsing' }
  | { kind: 'preview'; orders: GroupedOrder[]; errors: RowError[] }
  | { kind: 'submitting'; orders: GroupedOrder[]; errors: RowError[] }
  | {
      kind: 'done';
      result: BulkCreateOrdersResult;
      preErrors: RowError[];
    };

export function CsvImport({
  resolveSkus,
  importOrders,
  disabled = false,
  detailHrefPrefix,
}: {
  resolveSkus: ResolveSkusFn;
  importOrders: ImportOrdersFn;
  disabled?: boolean;
  detailHrefPrefix: string; // e.g. "/portal/orders" or "/warehouse/orders"
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [, startTransition] = useTransition();

  function reset() {
    setPhase({ kind: 'idle' });
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      toast.error(`File too large: limit is ${MAX_FILE_BYTES / 1_000_000} MB.`);
      e.target.value = '';
      return;
    }

    setPhase({ kind: 'parsing' });
    try {
      const text = await file.text();
      const parsed = parseCsv(text);

      if (parsed.parseErrors.length > 0) {
        const message = parsed.parseErrors
          .slice(0, 3)
          .map((p) => `Line ${p.row}: ${p.message}`)
          .join('; ');
        toast.error(`CSV parse error — ${message}`);
        setPhase({ kind: 'idle' });
        return;
      }

      const codes = Array.from(
        new Set(
          parsed.rows
            .map((r) => r.sku_code)
            .filter((c): c is string => typeof c === 'string' && c.length > 0),
        ),
      );
      const resolved = await resolveSkus(codes);
      const skuLookup: SkuLookup = new Map(Object.entries(resolved));

      const validated = validateRows(parsed.rows, skuLookup);
      setPhase({ kind: 'preview', orders: validated.orders, errors: validated.rowErrors });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Couldn't parse file: ${message}`);
      setPhase({ kind: 'idle' });
    } finally {
      e.target.value = '';
    }
  }

  function onSubmit() {
    if (phase.kind !== 'preview') return;
    const orders = phase.orders;
    if (orders.length === 0) {
      toast.error('No valid orders to submit.');
      return;
    }
    const preErrors = phase.errors;
    setPhase({ kind: 'submitting', orders, errors: preErrors });
    startTransition(async () => {
      const result = await importOrders(orders);
      if (!result.ok) {
        toast.error(result.error);
        setPhase({ kind: 'preview', orders, errors: preErrors });
        return;
      }
      toast.success(
        `Imported ${result.data.succeeded.length} order(s)${
          result.data.failed.length > 0 ? `, ${result.data.failed.length} failed` : ''
        }.`,
      );
      setPhase({ kind: 'done', result: result.data, preErrors });
    });
  }

  function downloadErrorsCsv() {
    if (phase.kind !== 'preview') return;
    const csv = errorsToCsv(phase.errors);
    triggerDownload(csv, 'orders-import-errors.csv');
  }

  return (
    <div className="space-y-6">
      {phase.kind === 'idle' || phase.kind === 'parsing' ? (
        <FilePicker disabled={disabled || phase.kind === 'parsing'} onChange={onFileChange} />
      ) : null}

      {phase.kind === 'preview' || phase.kind === 'submitting' ? (
        <PreviewView
          orders={phase.orders}
          errors={phase.errors}
          submitting={phase.kind === 'submitting'}
          onSubmit={onSubmit}
          onReset={reset}
          onDownloadErrors={downloadErrorsCsv}
        />
      ) : null}

      {phase.kind === 'done' ? (
        <ResultView
          result={phase.result}
          preErrors={phase.preErrors}
          onReset={reset}
          detailHrefPrefix={detailHrefPrefix}
        />
      ) : null}
    </div>
  );
}

function FilePicker({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className={`bg-muted/30 hover:bg-muted/50 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center transition ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <FileUp className="text-muted-foreground size-8" />
      <div>
        <div className="text-sm font-medium">Drop a CSV here or click to choose</div>
        <div className="text-muted-foreground text-xs">
          Up to 1000 rows · 2 MB · headers: {CSV_HEADERS.slice(0, 4).join(', ')}, …
        </div>
      </div>
      <input
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}

function PreviewView({
  orders,
  errors,
  submitting,
  onSubmit,
  onReset,
  onDownloadErrors,
}: {
  orders: GroupedOrder[];
  errors: RowError[];
  submitting: boolean;
  onSubmit: () => void;
  onReset: () => void;
  onDownloadErrors: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="secondary">{orders.length} valid order(s)</Badge>
          {errors.length > 0 ? (
            <Badge variant="destructive">{errors.length} row error(s)</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {errors.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={onDownloadErrors}>
              <Download className="size-4" />
              Download errors
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={submitting}>
            <RotateCcw className="size-4" />
            Start over
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={submitting || orders.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              `Submit ${orders.length} order(s)`
            )}
          </Button>
        </div>
      </div>

      {errors.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Rows with errors</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Line</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground text-sm">{e.row || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {e.groupKey ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{e.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {orders.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Orders to submit</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Ship to</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Total qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.groupKey}>
                    <TableCell className="font-mono text-sm">{o.groupKey}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {o.shipTo.name} — {o.shipTo.city}, {o.shipTo.region}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm">
                      {o.lines.length}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-sm">
                      {o.lines.reduce((s, l) => s + l.quantity, 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ResultView({
  result,
  preErrors,
  onReset,
  detailHrefPrefix,
}: {
  result: BulkCreateOrdersResult;
  preErrors: RowError[];
  onReset: () => void;
  detailHrefPrefix: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="default">{result.succeeded.length} succeeded</Badge>
          {result.failed.length > 0 ? (
            <Badge variant="destructive">{result.failed.length} failed</Badge>
          ) : null}
          {preErrors.length > 0 ? (
            <Badge variant="outline">{preErrors.length} skipped (validation)</Badge>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          <FileUp className="size-4" />
          Import another file
        </Button>
      </div>

      {result.succeeded.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Succeeded</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.succeeded.map((s) => (
                  <TableRow key={s.orderId}>
                    <TableCell className="font-mono text-sm">{s.groupKey}</TableCell>
                    <TableCell>
                      <Link
                        href={`${detailHrefPrefix}/${s.orderId}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {s.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {result.failed.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Failed</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.failed.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm">{f.groupKey}</TableCell>
                    <TableCell className="text-sm">{f.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function errorsToCsv(errors: RowError[]): string {
  const headers = ['line', 'group', 'error'];
  const lines = [
    headers.join(','),
    ...errors.map((e) =>
      [e.row, e.groupKey ?? '', csvCell(e.message)].map((v) => String(v)).join(','),
    ),
  ];
  return lines.join('\n');
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
