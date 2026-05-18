'use client';

// Ship form: carrier dropdown + tracking number + optional ship notes. When
// carrier=OTHER, a `carrierOther` text input becomes visible and required.
// All inputs flow through zod (defense in depth — server re-validates).

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Carrier } from '@prisma/client';
import { Loader2 } from 'lucide-react';
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
import { shipOrderInputSchema, type ShipOrderInput } from '@/features/orders';
import { shipOrderAction } from '../actions';

const CARRIER_LABELS: Record<Carrier, string> = {
  USPS: 'USPS',
  UPS: 'UPS',
  FEDEX: 'FedEx',
  DHL: 'DHL',
  OTHER: 'Other (specify)',
};

export function ShipForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<ShipOrderInput>({
    resolver: zodResolver(shipOrderInputSchema),
    defaultValues: {
      orderId,
      carrier: Carrier.USPS,
      carrierOther: '',
      trackingNumber: '',
      shipNotes: '',
    },
  });

  const watchedCarrier = form.watch('carrier');
  const isOther = watchedCarrier === Carrier.OTHER;

  function onSubmit(values: ShipOrderInput) {
    startTransition(async () => {
      const result = await shipOrderAction(values);
      if (result.ok) {
        toast.success('Order shipped');
        router.push(`/warehouse/orders/${orderId}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="carrier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Carrier</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a carrier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(CARRIER_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {isOther ? (
            <FormField
              control={form.control}
              name="carrierOther"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Carrier name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Custom Courier"
                      maxLength={60}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
        </div>

        <FormField
          control={form.control}
          name="trackingNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tracking number</FormLabel>
              <FormControl>
                <Input
                  placeholder="9405511899223197428490"
                  maxLength={120}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shipNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ship notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Handed to carrier 3pm; signature collected…"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Confirming ship…
              </>
            ) : (
              'Confirm shipped'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
