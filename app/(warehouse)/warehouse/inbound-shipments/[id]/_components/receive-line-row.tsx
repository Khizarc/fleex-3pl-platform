'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { TableCell, TableRow } from '@/components/ui/table';
import { receiveLineAction } from '../actions';

export type BinOption = { id: string; label: string; zoneName: string; aisleName: string };

export function ReceiveLineRow({
  lineId,
  skuCode,
  expectedQuantity,
  bins,
  disabled,
}: {
  lineId: string;
  skuCode: string;
  expectedQuantity: number;
  bins: BinOption[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actualQty, setActualQty] = useState<number>(expectedQuantity);
  const [binId, setBinId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [damaged, setDamaged] = useState(false);

  function submit() {
    if (!binId) {
      toast.error('Pick a bin');
      return;
    }
    startTransition(async () => {
      const result = await receiveLineAction({
        lineId,
        actualQuantity: actualQty,
        binId,
        notes: notes || undefined,
        damaged,
      });
      if (result.ok) {
        toast.success(`Line ${skuCode} received`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="align-top font-mono text-sm">{skuCode}</TableCell>
      <TableCell className="text-right align-top">{expectedQuantity}</TableCell>
      <TableCell className="align-top">
        <Input
          type="number"
          min={0}
          value={actualQty}
          onChange={(e) => setActualQty(e.target.valueAsNumber || 0)}
          disabled={disabled || pending}
          className="w-24"
        />
      </TableCell>
      <TableCell className="align-top">
        <Select value={binId} onValueChange={setBinId} disabled={disabled || pending}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Pick a bin" />
          </SelectTrigger>
          <SelectContent>
            {bins.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.zoneName} · {b.aisleName} · {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="align-top">
        <div className="space-y-2">
          <Textarea
            placeholder="Damage / notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled || pending}
            rows={1}
          />
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={damaged}
              onChange={(e) => setDamaged(e.target.checked)}
              disabled={disabled || pending}
            />
            Mark as damaged (goes to DAMAGED stock pool)
          </label>
        </div>
      </TableCell>
      <TableCell className="text-right align-top">
        <Button size="sm" onClick={submit} disabled={disabled || pending}>
          <Check className="size-4" />
          {pending ? 'Saving' : 'Receive'}
        </Button>
      </TableCell>
    </TableRow>
  );
}
