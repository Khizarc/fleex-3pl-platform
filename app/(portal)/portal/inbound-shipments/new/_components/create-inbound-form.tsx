'use client';

// Dynamic-line-items form. react-hook-form `useFieldArray` lets the user
// add/remove rows of (SKU + expected quantity) inline.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createInboundShipmentSchema, type CreateInboundShipmentInput } from '@/features/inbound';
import { createInboundShipmentAction } from '../../actions';

type WarehouseOption = { id: string; name: string };
type SkuOption = { id: string; code: string; name: string };

export function CreateInboundForm({
  warehouses,
  skus,
}: {
  warehouses: WarehouseOption[];
  skus: SkuOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateInboundShipmentInput>({
    resolver: zodResolver(createInboundShipmentSchema),
    defaultValues: {
      warehouseId: '',
      reference: '',
      notes: '',
      lines: [{ skuId: '', expectedQuantity: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });

  function onSubmit(values: CreateInboundShipmentInput) {
    startTransition(async () => {
      const result = await createInboundShipmentAction(values);
      if (result.ok) {
        toast.success('Shipment notice created');
        router.push(`/portal/inbound-shipments/${result.data.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const disabled = warehouses.length === 0 || skus.length === 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {disabled ? (
          <div className="bg-muted/50 text-muted-foreground rounded-md border p-4 text-sm">
            You need at least one warehouse from your 3PL and at least one SKU in your catalog
            before you can notify of incoming inventory.
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="warehouseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Destination warehouse</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a warehouse" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reference"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Your reference (optional)</FormLabel>
              <FormControl>
                <Input placeholder="PO-001" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Anything the warehouse should know"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel>Line items</FormLabel>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ skuId: '', expectedQuantity: 1 })}
              disabled={disabled}
            >
              <Plus className="size-4" />
              Add line
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((row, i) => (
              <div key={row.id} className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
                <FormField
                  control={form.control}
                  name={`lines.${i}.skuId`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">SKU</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Pick a SKU" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {skus.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <span className="font-mono">{s.code}</span> — {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`lines.${i}.expectedQuantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => remove(i)}
                  disabled={fields.length <= 1}
                  aria-label="Remove line"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || disabled}>
            {pending ? 'Creating…' : 'Notify 3PL'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
