'use client';

// Pack form: 3 dimension inputs (inches) + weight input (ounces) + optional
// pack notes. Converts inches→mm and ounces→grams at submit so the server
// receives canonical units.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Textarea } from '@/components/ui/textarea';
import { inchesToMm, ouncesToGrams } from '@/features/orders';
import { packOrderAction } from '../actions';

// Form-layer schema: inches/ounces with realistic caps. Converted to mm/g
// before posting. Client-side caps mirror the server-side mm/g caps after
// conversion (3000 mm ≈ 118 in; 500_000 g ≈ 17_637 oz).
const formSchema = z.object({
  lengthIn: z
    .number({ message: 'Length must be a number' })
    .positive('Length must be greater than zero')
    .max(118, 'Length too large'),
  widthIn: z
    .number({ message: 'Width must be a number' })
    .positive('Width must be greater than zero')
    .max(118, 'Width too large'),
  heightIn: z
    .number({ message: 'Height must be a number' })
    .positive('Height must be greater than zero')
    .max(118, 'Height too large'),
  weightOz: z
    .number({ message: 'Weight must be a number' })
    .positive('Weight must be greater than zero')
    .max(17_637, 'Weight too large'),
  packNotes: z.string().trim().max(2000).optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function PackForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lengthIn: 0,
      widthIn: 0,
      heightIn: 0,
      weightOz: 0,
      packNotes: '',
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await packOrderAction({
        orderId,
        boxLengthMm: inchesToMm(values.lengthIn),
        boxWidthMm: inchesToMm(values.widthIn),
        boxHeightMm: inchesToMm(values.heightIn),
        boxWeightG: ouncesToGrams(values.weightOz),
        packNotes: values.packNotes || undefined,
      });
      if (result.ok) {
        toast.success('Order packed');
        router.push(`/warehouse/orders/${orderId}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-medium">Box dimensions</h2>
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="lengthIn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Length (in)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="10"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="widthIn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Width (in)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="8"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="heightIn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Height (in)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step="0.1"
                      placeholder="6"
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
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
          name="weightOz"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Weight (oz)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="24"
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                  className="max-w-xs"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="packNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pack notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Fragile sticker applied; corners reinforced…"
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
                Marking packed…
              </>
            ) : (
              'Mark packed'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
