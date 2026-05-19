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
    <CardContent
      className={cn(
        'flex items-start gap-3 p-4 transition-colors',
        href ? 'group-hover:bg-accent/40 cursor-pointer' : '',
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md',
          tone === 'attention'
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </div>
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        <Card>{content}</Card>
      </Link>
    );
  }
  return <Card>{content}</Card>;
}
