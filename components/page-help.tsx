'use client';

import Link from 'next/link';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { PAGE_HELP } from '@/lib/page-help-content';

export function PageHelp({ helpKey }: { helpKey: string }) {
  const content = PAGE_HELP[helpKey];
  if (!content) return null;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Page help">
          <HelpCircle className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{content.title}</SheetTitle>
          <SheetDescription>{content.whatItIsFor}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 overflow-y-auto p-4 pt-2">
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              How it works
            </h3>
            <ul className="text-foreground space-y-2 text-sm">
              {content.howItWorks.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Common tasks
            </h3>
            <ul className="text-foreground space-y-1.5 text-sm">
              {content.commonTasks.map((task, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </section>

          {content.related && content.related.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Related
              </h3>
              <ul className="space-y-1.5">
                {content.related.map((r, i) => (
                  <li key={i}>
                    <Link
                      href={r.href}
                      className="text-foreground inline-flex items-center gap-1 text-sm hover:underline"
                    >
                      {r.label}
                      <ArrowRight className="size-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
