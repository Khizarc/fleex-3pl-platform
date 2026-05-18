'use client';

// One row of the pick screen: bin label visible to the picker, an input
// they type/paste the label into, and a Confirm button. Server compares
// the input against the actual bin label and writes the pick on match.
//
// Already-picked rows render greyed-out with the picker name + timestamp.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pickAllocationAction } from '../actions';

export function PickRow({
  orderId,
  allocationId,
  binLabel,
  zoneName,
  aisleName,
  skuCode,
  skuName,
  quantity,
  personalization,
  pickedAt,
  pickedByName,
}: {
  orderId: string;
  allocationId: string;
  binLabel: string;
  zoneName: string;
  aisleName: string;
  skuCode: string;
  skuName: string;
  quantity: number;
  personalization: { fieldKey: string; value: string }[];
  pickedAt: Date | null;
  pickedByName: string | null;
}) {
  const router = useRouter();
  const [scanned, setScanned] = useState('');
  const [pending, startTransition] = useTransition();

  const isPicked = pickedAt !== null;

  function onConfirm() {
    if (!scanned.trim()) {
      toast.error('Type or scan the bin label first.');
      return;
    }
    startTransition(async () => {
      const result = await pickAllocationAction(orderId, {
        allocationId,
        scannedBinLabel: scanned,
      });
      if (result.ok) {
        toast.success(`Picked ${quantity} × ${skuCode} from ${binLabel}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className={`rounded-md border p-4 ${isPicked ? 'bg-muted/30 opacity-70' : 'bg-card'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              {zoneName} / {aisleName}
            </span>
          </div>
          <div className="font-mono text-2xl font-semibold tracking-tight">{binLabel}</div>
          <div className="text-sm">
            <span className="font-mono">{skuCode}</span>{' '}
            <span className="text-muted-foreground">— {skuName}</span>
          </div>
          {personalization.length > 0 ? (
            <dl className="text-muted-foreground mt-1 grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5 text-xs">
              {personalization.map((p, i) => (
                <div key={i} className="contents">
                  <dt className="font-mono">{p.fieldKey}</dt>
                  <dd className="text-foreground">{p.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <div className="text-right">
          <div className="text-muted-foreground text-xs">Quantity</div>
          <div className="text-2xl font-semibold">{quantity}</div>
        </div>
      </div>

      <div className="mt-4">
        {isPicked ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Check className="size-4" />
            Picked
            {pickedByName ? ` by ${pickedByName}` : ''}
            {pickedAt ? ` · ${pickedAt.toLocaleString()}` : ''}
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-muted-foreground text-xs">Scan or type bin label</label>
              <Input
                placeholder={`Type "${binLabel}"`}
                value={scanned}
                onChange={(e) => setScanned(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !pending) {
                    e.preventDefault();
                    onConfirm();
                  }
                }}
                disabled={pending}
              />
            </div>
            <Button onClick={onConfirm} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Confirming…
                </>
              ) : (
                'Confirm pick'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
