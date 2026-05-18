'use client';

// Per-staff row controls: change role + change status. Self-protection
// hides controls on the viewer's own row (so an ADMIN can't accidentally
// brick themselves).

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AccountStatus, Role } from '@prisma/client';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateStaffRoleAction, updateStaffStatusAction } from '../actions';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  RECEIVER: 'Receiver',
  PICKER: 'Picker',
  PACKER: 'Packer',
  SHIPPER: 'Shipper',
};

const STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  DISABLED: 'Disabled',
};

export function ManageStaffRow({
  userId,
  currentRole,
  currentStatus,
  isSelf,
}: {
  userId: string;
  currentRole: Role;
  currentStatus: AccountStatus;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onRoleChange(role: string) {
    if (role === currentRole) return;
    startTransition(async () => {
      const result = await updateStaffRoleAction({ userId, role: role as Role });
      if (result.ok) {
        toast.success('Role updated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function onStatusChange(status: string) {
    if (status === currentStatus) return;
    startTransition(async () => {
      const result = await updateStaffStatusAction({
        userId,
        status: status as AccountStatus,
      });
      if (result.ok) {
        toast.success('Status updated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (isSelf) {
    return <span className="text-muted-foreground text-xs italic">(you)</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={currentRole} onValueChange={onRoleChange} disabled={pending}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={currentStatus} onValueChange={onStatusChange} disabled={pending}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
