'use client';

// Staff-side new-order form. Adds a client picker that gates the SKU options.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { createOrderInputSchema } from '@/features/orders';
import { createOrderAction } from '../../actions';

const formSchema = createOrderInputSchema.extend({
  clientId: z.string().min(1, 'Pick a client'),
});
type FormValues = z.infer<typeof formSchema>;

type ClientOption = {
  id: string;
  name: string;
  skus: Array<{ id: string; code: string; name: string }>;
  definitions: Array<{ id: string; key: string; label: string; required: boolean }>;
};

export function StaffCreateOrderForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeClientId, setActiveClientId] = useState<string>('');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: '',
      shipToName: '',
      shipToLine1: '',
      shipToLine2: '',
      shipToCity: '',
      shipToRegion: '',
      shipToPostalCode: '',
      shipToCountry: 'US',
      customerNote: '',
      lines: [{ skuId: '', quantity: 1 }],
    },
  });
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'lines',
  });

  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeClientId),
    [clients, activeClientId],
  );
  const activeSkus = activeClient?.skus ?? [];
  const activeDefinitions = activeClient?.definitions ?? [];

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createOrderAction(values);
      if (result.ok) {
        toast.success('Order submitted');
        router.push(`/warehouse/orders/${result.data.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const disabled = clients.length === 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {disabled ? (
          <div className="bg-muted/50 text-muted-foreground rounded-md border p-4 text-sm">
            No clients exist yet. Add at least one client before placing an order.
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client</FormLabel>
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  setActiveClientId(v);
                  // Reset line items when client changes — old SKUs aren't valid.
                  replace([{ skuId: '', quantity: 1 }]);
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a client" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Ship to</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="shipToName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Recipient name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shipToLine1"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address line 1</FormLabel>
                  <FormControl>
                    <Input placeholder="123 Main St" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shipToLine2"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address line 2 (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Apt 4B" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shipToCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shipToRegion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State / region</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shipToPostalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal code</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shipToCountry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country (2-letter)</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={2}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <FormField
          control={form.control}
          name="customerNote"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note (optional)</FormLabel>
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

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Line items</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ skuId: '', quantity: 1 })}
              disabled={disabled || !activeClientId}
            >
              <Plus className="size-4" />
              Add line
            </Button>
          </div>

          {!activeClientId ? (
            <p className="text-muted-foreground text-sm">Pick a client to see their SKUs.</p>
          ) : activeSkus.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              This client has no SKUs in their catalog yet.
            </p>
          ) : (
            <div className="space-y-4">
              {fields.map((row, i) => (
                <div key={row.id} className="space-y-2 rounded-md border p-3">
                  <div className="grid grid-cols-[1fr_120px_auto] items-end gap-2">
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
                              {activeSkus.map((s) => (
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
                      name={`lines.${i}.quantity`}
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
                  {activeDefinitions.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeDefinitions.map((def) => (
                        <FormField
                          key={def.id}
                          control={form.control}
                          name={`lines.${i}.personalization.${def.key}`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">
                                {def.label}
                                {def.required ? <span className="text-destructive"> *</span> : null}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ''}
                                  maxLength={500}
                                  placeholder={def.required ? 'Required' : 'Optional'}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || disabled || !activeClientId}>
            {pending ? 'Submitting…' : 'Submit order'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
