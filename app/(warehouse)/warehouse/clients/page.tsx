import { Users } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { listClients } from '@/features/clients';
import { getCurrentStaffContext } from '@/lib/auth';
import { ClientsTable } from './_components/clients-table';
import { CreateClientDialog } from './_components/create-client-dialog';

export default async function ClientsPage() {
  const { tenant } = await getCurrentStaffContext();
  const clients = await listClients(tenant);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-muted-foreground text-sm">
            The customers your 3PL warehouses goods for.
          </p>
        </div>
        <CreateClientDialog />
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to start receiving inventory and fulfilling orders."
        />
      ) : (
        <div className="rounded-lg border">
          <ClientsTable clients={clients} />
        </div>
      )}
    </div>
  );
}
