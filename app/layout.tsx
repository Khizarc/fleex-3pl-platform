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
        <body className="bg-background text-foreground antialiased">
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
