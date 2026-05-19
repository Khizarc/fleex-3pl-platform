import { Users } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { listClients } from '@/features/clients';
import { getCurrentStaffContext } from '@/lib/auth';
import { ClientsTable } from './_components/clients-table';
import { CreateClientDialog } from './_components/create-client-dialog';

export default async function ClientsPage() {
  const { tenant } = await getCurrentStaffContext();
  const clients = await listClients(tenant);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="The brands you store and ship goods for. Each client has its own products, inventory, and orders."
        action={<CreateClientDialog />}
        helpKey="warehouse.clients"
      />

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to start receiving inventory and fulfilling orders."
          action={<CreateClientDialog />}
        />
      ) : (
        <div className="rounded-lg border">
          <ClientsTable clients={clients} />
        </div>
      )}
    </div>
  );
}
