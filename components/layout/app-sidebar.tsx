'use client';

import {
  ArchiveRestore,
  Boxes,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Users,
  Warehouse,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
} from '@/components/ui/sidebar';
import { SidebarNavItem, type SidebarNavItemProps } from './sidebar-nav-item';

export type ShellVariant = 'warehouse' | 'portal';

const warehouseNav: SidebarNavItemProps[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/warehouse' },
  { label: 'Clients', icon: Users, href: '/warehouse/clients' },
  { label: 'Inventory', icon: Boxes, comingIn: 'Phase 1' },
  { label: 'Orders', icon: ShoppingBag, comingIn: 'Phase 1' },
  { label: 'Settings', icon: Settings, comingIn: 'Phase 1' },
];

const portalNav: SidebarNavItemProps[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/portal' },
  { label: 'Inventory', icon: Boxes, comingIn: 'Phase 1' },
  { label: 'Orders', icon: ShoppingBag, comingIn: 'Phase 1' },
  { label: 'Returns', icon: ArchiveRestore, comingIn: 'Phase 5' },
];

export function AppSidebar({ variant, brand }: { variant: ShellVariant; brand: string }) {
  const items = variant === 'warehouse' ? warehouseNav : portalNav;
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Warehouse className="size-5 shrink-0" />
          <span className="truncate text-sm font-semibold">{brand}</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarNavItem key={item.label} {...item} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
