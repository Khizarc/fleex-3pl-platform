import type { ReactNode } from 'react';

export default function PortalGroupLayout({ children }: { children: ReactNode }) {
  // Client auth gate lands in Milestone 0.3.
  return <>{children}</>;
}
