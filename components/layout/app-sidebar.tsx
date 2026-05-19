'use client';

import {
  ArchiveRestore,
  Boxes,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  Send,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SidebarNavItem, type SidebarNavItemProps } from './sidebar-nav-item';

export type ShellVariant = 'warehouse' | 'portal';

interface NavSection {
  label: string;
  items: SidebarNavItemProps[];
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: 'Full access — manage everything in this company.',
  RECEIVER: 'Check in inbound inventory.',
  PICKER: 'Pick items for orders.',
  PACKER: 'Pack picked orders.',
  SHIPPER: 'Generate labels and ship orders.',
};

const warehouseSections: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/warehouse' }],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Clients', icon: Users, href: '/warehouse/clients' },
      { label: 'Warehouses', icon: Building2, href: '/warehouse/warehouses' },
    ],
  },
  {
    label: 'Inbound',
    items: [
      { label: 'Inbound shipments', icon: Truck, href: '/warehouse/inbound-shipments' },
      { label: 'Inventory', icon: Boxes, href: '/warehouse/inventory' },
    ],
  },
  {
    label: 'Outbound',
    items: [
      { label: 'Orders', icon: ShoppingBag, href: '/warehouse/orders' },
      { label: 'Pick', icon: ClipboardCheck, href: '/warehouse/pick' },
      { label: 'Pack', icon: Package, href: '/warehouse/pack' },
      { label: 'Ship', icon: Send, href: '/warehouse/ship' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { label: 'Team', icon: UserCog, href: '/warehouse/team' },
      { label: 'Settings', icon: Settings, comingIn: 'Phase 5' },
    ],
  },
];

const portalSections: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', icon: LayoutDashboard, href: '/portal' }],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', icon: Package, href: '/portal/products' },
      { label: 'Personalization', icon: Sparkles, href: '/portal/personalization' },
    ],
  },
  {
    label: 'Inbound',
    items: [
      { label: 'Inbound shipments', icon: Truck, href: '/portal/inbound-shipments' },
      { label: 'Inventory', icon: Boxes, href: '/portal/inventory' },
    ],
  },
  {
    label: 'Outbound',
    items: [
      { label: 'Orders', icon: ShoppingBag, href: '/portal/orders' },
      { label: 'Returns', icon: ArchiveRestore, comingIn: 'Phase 5' },
    ],
  },
];

export function AppSidebar({
  variant,
  brand,
  role,
}: {
  variant: ShellVariant;
  brand: string;
  role?: string;
}) {
  const sections = variant === 'warehouse' ? warehouseSections : portalSections;
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-start gap-2 px-2 py-1.5">
          <Warehouse className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{brand}</p>
            {role ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground/80 mt-0.5 inline-block text-[10px] font-medium tracking-wide uppercase">
                    {role}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {ROLE_DESCRIPTIONS[role] ?? 'Your role in this company.'}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarNavItem key={item.label} {...item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
