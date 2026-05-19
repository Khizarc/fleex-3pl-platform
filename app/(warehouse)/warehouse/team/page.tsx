import { redirect } from 'next/navigation';
import type { AccountStatus } from '@prisma/client';
import { Role } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/page-header';
import { listStaff } from '@/features/team';
import { getCurrentStaffContext } from '@/lib/auth';
import { InviteStaffDialog } from './_components/invite-staff-dialog';
import { ManageStaffRow } from './_components/manage-staff-row';

const STATUS_VARIANT: Record<AccountStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ACTIVE: 'default',
  SUSPENDED: 'destructive',
  DISABLED: 'outline',
};

export default async function TeamPage() {
  const { tenant, user } = await getCurrentStaffContext();
  if (user.role !== Role.ADMIN) {
    redirect('/warehouse');
  }

  const staff = await listStaff(tenant);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Your warehouse staff — admins, receivers, pickers, packers, and shippers. (To invite a client's portal user instead, open the client's detail page.)"
        action={<InviteStaffDialog />}
        helpKey="warehouse.team"
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role &amp; status (edit)</TableHead>
              <TableHead className="text-right">Inbound</TableHead>
              <TableHead className="text-right">Picks</TableHead>
              <TableHead className="text-right">Packs</TableHead>
              <TableHead className="text-right">Ships</TableHead>
              <TableHead className="text-right">Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  {s.name}
                  {s.authProviderId === null ? (
                    <span className="text-muted-foreground ml-1 text-xs">(pending claim)</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{s.email}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                </TableCell>
                <TableCell>
                  <ManageStaffRow
                    userId={s.id}
                    currentRole={s.role}
                    currentStatus={s.status}
                    isSelf={s.id === user.id}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {s.inboundLinesReceived}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {s.picksCompleted}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {s.ordersPacked}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {s.ordersShipped}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  {s.lastActivityAt ? s.lastActivityAt.toLocaleDateString() : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
