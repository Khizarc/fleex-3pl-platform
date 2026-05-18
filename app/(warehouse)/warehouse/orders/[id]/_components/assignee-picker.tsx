'use client';

// ADMIN assigns an order to a specific staff member. Renders a Select of
// ACTIVE staff in the company + an "Unassign" option. On change, calls the
// server action and refreshes the page.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { assignOrderAction } from '../actions';

type StaffOption = { id: string; name: string; role: string };

const UNASSIGNED_VALUE = '__unassigned__';

export function AssigneePicker({
  orderId,
  currentAssigneeId,
  options,
}: {
  orderId: string;
  currentAssigneeId: string | null;
  options: StaffOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(value: string) {
    const next = value === UNASSIGNED_VALUE ? null : value;
    startTransition(async () => {
      const result = await assignOrderAction(orderId, next);
      if (result.ok) {
        toast.success(next ? 'Order assigned' : 'Order unassigned');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Select
      value={currentAssigneeId ?? UNASSIGNED_VALUE}
      onValueChange={handleChange}
      disabled={pending}
    >
      <SelectTrigger className="max-w-sm">
        <SelectValue placeholder="Pick a staff member" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
        {options.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name} <span className="text-muted-foreground">· {s.role}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
