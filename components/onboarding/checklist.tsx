'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, Circle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface OnboardingStep {
  key: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
}

interface ChecklistProps {
  steps: OnboardingStep[];
  title?: string;
  subtitle?: string;
}

export function OnboardingChecklist({
  steps,
  title = 'Get your warehouse running',
  subtitle = 'Five steps to take your first order from notification to ship.',
}: ChecklistProps) {
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = done === total;
  const [dismissed, setDismissed] = useState(false);

  if (allDone && dismissed) return null;

  if (allDone) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="size-4" />
            </div>
            <div>
              <p className="font-medium">Setup complete</p>
              <p className="text-muted-foreground text-sm">
                You&apos;ve completed all onboarding steps. Tour the order pipeline next.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="default" size="sm">
              <Link href="/warehouse/orders">
                View orders
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-4 p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-muted-foreground text-sm">{subtitle}</p>
            </div>
            <span className="text-muted-foreground text-sm font-medium tabular-nums">
              {done} of {total}
            </span>
          </div>
          <Progress value={percent} className="h-1.5" />
        </div>
        <ol className="space-y-1">
          {steps.map((step, i) => (
            <li
              key={step.key}
              className={cn(
                'flex items-center gap-3 rounded-md p-2 transition-all duration-150 ease-out',
                step.done ? 'opacity-60' : 'hover:bg-accent/40',
              )}
            >
              <div
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border',
                  step.done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-muted-foreground/30 text-muted-foreground',
                )}
              >
                {step.done ? <Check className="size-3.5" /> : <Circle className="size-3" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', step.done && 'line-through')}>
                  {i + 1}. {step.label}
                </p>
                <p className="text-muted-foreground text-xs">{step.description}</p>
              </div>
              {!step.done ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={step.href}>
                    Go
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
