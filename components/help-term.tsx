import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HelpTermProps {
  children: ReactNode;
  definition: string;
}

// Inline tooltip for jargon. Wrap any piece of in-context text where a new
// user might not know what a term means — column headers, status badges, etc.
// Renders a subtle dotted underline as the affordance.
export function HelpTerm({ children, definition }: HelpTermProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="decoration-muted-foreground/40 cursor-help underline decoration-dotted underline-offset-2">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {definition}
      </TooltipContent>
    </Tooltip>
  );
}
