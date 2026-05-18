import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fleex 3PL Platform',
  description: 'Multi-tenant 3PL warehouse and shipping platform.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        {/*
         * suppressHydrationWarning on <body> too: browser extensions
         * (Grammarly, LanguageTool, password managers, etc.) inject
         * data-* attributes here client-side, which would otherwise
         * trigger a harmless but noisy hydration warning.
         */}
        <body className="bg-background text-foreground antialiased" suppressHydrationWarning>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
