'use client';

// Shared dialog used by both shells. The parent passes its own server action
// as the `action` prop, which resolves the right tenant context per shell.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { createProductSchema, type CreateProductInput } from '@/features/products';

type ActionResult = { ok: true; data: { id: string } } | { ok: false; error: string };

export function CreateProductDialog({
  action,
  triggerLabel = 'Add product',
  onCreatedHref,
}: {
  action: (input: CreateProductInput) => Promise<ActionResult>;
  triggerLabel?: string;
  /** When provided, after create the dialog navigates here with ?addSku=1 so
   * the SKU dialog auto-opens (Shopify-style streamlined flow). */
  onCreatedHref?: (id: string) => string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: '', description: '' },
  });

  function onSubmit(values: CreateProductInput) {
    startTransition(async () => {
      const result = await action(values);
      if (result.ok) {
        toast.success('Product created');
        form.reset();
        setOpen(false);
        if (onCreatedHref) {
          router.push(`${onCreatedHref(result.data.id)}?addSku=1`);
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a product</DialogTitle>
          <DialogDescription>
            Define a sellable product. You can add SKU variants after creating it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Tee" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Cotton t-shirt, screen printed"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create product'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
