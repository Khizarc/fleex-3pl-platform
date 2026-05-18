import type { ReactNode } from 'react';

export default function WarehouseGroupLayout({ children }: { children: ReactNode }) {
  // Staff auth gate lands in Milestone 0.3.
  return <>{children}</>;
}
