import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppHeader } from './app-header';
import { AppSidebar, type ShellVariant } from './app-sidebar';

interface AppShellProps {
  variant: ShellVariant;
  brand: string;
  role?: string;
  children: ReactNode;
}

// Wraps a route group's page content with the sidebar + header chrome.
// Server component — Sidebar/SidebarInset themselves bring their own
// 'use client' boundary internally where needed.
export function AppShell({ variant, brand, role, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar variant={variant} brand={brand} role={role} />
      <SidebarInset>
        <AppHeader brand={brand} />
        <main className="flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
