'use client';

// Per-staff row controls: change role + change status. Self-protection
// hides controls on the viewer's own row (so an ADMIN can't accidentally
// brick themselves). Destructive status transitions (SUSPENDED, DISABLED)
// go through a ConfirmDialog so misclicks don't disable a real worker.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AccountStatus, Role } from '@prisma/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

const DESTRUCTIVE_STATUSES: AccountStatus[] = ['SUSPENDED', 'DISABLED'];

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
  const [pendingStatus, setPendingStatus] = useState<AccountStatus | null>(null);

  function applyStatus(status: AccountStatus) {
    startTransition(async () => {
      const result = await updateStaffStatusAction({ userId, status });
      if (result.ok) {
        toast.success('Status updated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setPendingStatus(null);
    });
  }

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

  function onStatusChange(value: string) {
    const next = value as AccountStatus;
    if (next === currentStatus) return;
    if (DESTRUCTIVE_STATUSES.includes(next)) {
      setPendingStatus(next);
      return;
    }
    applyStatus(next);
  }

  if (isSelf) {
    return <span className="text-muted-foreground text-xs italic">(you)</span>;
  }

  return (
    <>
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
      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === 'DISABLED'
                ? 'Disable this staff member?'
                : 'Suspend this staff member?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === 'DISABLED'
                ? "Disabled users can't sign in or perform any action. Their existing assignments are kept but you'll need to reassign them."
                : 'Suspended users can sign in but their role gates will reject any work. Re-activate at any time.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep active</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                if (pendingStatus) applyStatus(pendingStatus);
              }}
              disabled={pending}
            >
              {pending ? 'Working…' : pendingStatus === 'DISABLED' ? 'Disable' : 'Suspend'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
