'use client';

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
import { createSkuSchema, type CreateSkuInput } from '@/features/products';

type ActionResult = { ok: true; data: { id: string } } | { ok: false; error: string };

export function CreateSkuDialog({
  action,
  defaultOpen = false,
}: {
  action: (input: CreateSkuInput) => Promise<ActionResult>;
  /** Open on mount — used when the product was just created and we want the
   * SKU dialog to appear without an extra click. */
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateSkuInput>({
    resolver: zodResolver(createSkuSchema),
    defaultValues: { code: '', name: '' },
  });

  function onSubmit(values: CreateSkuInput) {
    startTransition(async () => {
      const result = await action(values);
      if (result.ok) {
        toast.success('SKU created', {
          action: {
            label: 'Add another',
            onClick: () => {
              form.reset();
              setOpen(true);
            },
          },
        });
        form.reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          Add SKU
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a SKU</DialogTitle>
          <DialogDescription>
            A specific variant of this product (size, color, etc.). Codes are unique within your
            catalog.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input placeholder="TEE-RED-L" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variant name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Tee · Red · Large" {...field} />
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
                {pending ? 'Creating…' : 'Create SKU'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
