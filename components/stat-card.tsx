import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  tone?: 'default' | 'attention';
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = 'default',
}: StatCardProps) {
  const content = (
    <CardContent className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md',
            tone === 'attention'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-3.5" />
        </div>
      </div>
      <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <Card hoverable>{content}</Card>
      </Link>
    );
  }
  return <Card>{content}</Card>;
}
