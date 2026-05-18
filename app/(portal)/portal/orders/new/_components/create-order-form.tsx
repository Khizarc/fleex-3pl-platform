'use client';

// Portal-side new-order form. Dynamic line items via useFieldArray. Ship-to
// fields are inline. SKU options are passed in from the server page.

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
import { createOrderInputSchema, type CreateOrderInput } from '@/features/orders';
import { createOrderAction } from '../../actions';

type SkuOption = { id: string; code: string; name: string };
type FieldDef = { id: string; key: string; label: string; required: boolean };

export function CreateOrderForm({
  skus,
  definitions,
}: {
  skus: SkuOption[];
  definitions: FieldDef[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderInputSchema),
    defaultValues: {
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
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });

  function onSubmit(values: CreateOrderInput) {
    startTransition(async () => {
      const result = await createOrderAction(values);
      if (result.ok) {
        toast.success('Order submitted');
        router.push(`/portal/orders/${result.data.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const disabled = skus.length === 0;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {disabled ? (
          <div className="bg-muted/50 text-muted-foreground rounded-md border p-4 text-sm">
            Your catalog has no SKUs yet. Add at least one SKU before placing an order.
          </div>
        ) : null}

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
              disabled={disabled}
            >
              <Plus className="size-4" />
              Add line
            </Button>
          </div>

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
                {definitions.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {definitions.map((def) => (
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
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || disabled}>
            {pending ? 'Submitting…' : 'Submit order'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
