'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface SidebarNavItemProps {
  label: string;
  icon: LucideIcon;
  href?: string;
  // If set, the item renders disabled with a tooltip describing the future
  // milestone or phase it lands in. Use omitted/undefined for live links.
  comingIn?: string;
}

export function SidebarNavItem({ label, icon: Icon, href, comingIn }: SidebarNavItemProps) {
  const pathname = usePathname();

  if (!href) {
    return (
      <SidebarMenuItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-disabled="true"
              className="text-sidebar-foreground/50 flex w-full cursor-not-allowed items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="right">Lands in {comingIn}</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  }

  // Match exact path for top-level nav items; for nested routes (e.g.
  // /warehouse/clients/[id]) we still want "Clients" highlighted.
  const isActive =
    pathname === href || (href !== '/warehouse' && href !== '/portal' && pathname.startsWith(href));
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={label}
        className={cn(
          'relative transition-colors',
          isActive &&
            "before:bg-primary before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:content-['']",
        )}
      >
        <Link href={href}>
          <Icon className="size-4" />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
