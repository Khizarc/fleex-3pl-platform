import { Card } from '@/components/ui/card';

interface SummaryRow {
  label: string;
  value: React.ReactNode;
}

interface OrderSummaryCardProps {
  rows: SummaryRow[];
}

export function OrderSummaryCard({ rows }: OrderSummaryCardProps) {
  return (
    <Card>
      <dl className="divide-y text-sm">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between gap-3 p-3">
            <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {row.label}
            </dt>
            <dd className="text-foreground text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
