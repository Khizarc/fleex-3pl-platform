import { UserButton } from '@clerk/nextjs';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function AppHeader({ brand }: { brand: string }) {
  return (
    <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <h1 className="text-sm font-semibold">{brand}</h1>
      <div className="ml-auto">
        <UserButton />
      </div>
    </header>
  );
}
