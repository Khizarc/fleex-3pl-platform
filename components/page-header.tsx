import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHelp } from './page-help';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
  helpKey?: string;
}

export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel,
  helpKey,
}: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {backHref ? (
        <Link
          href={backHref}
          className="text-muted-foreground inline-flex items-center text-sm hover:underline"
        >
          <ChevronLeft className="size-4" />
          {backLabel ?? 'Back'}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {helpKey ? <PageHelp helpKey={helpKey} /> : null}
          </div>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
