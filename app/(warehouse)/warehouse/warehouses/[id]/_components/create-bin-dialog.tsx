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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createBinSchema, type CreateBinInput } from '@/features/warehouses';
import { createBinAction } from '../../actions';

// Aisles are passed flat with their zone name prefixed so the user can
// disambiguate (e.g., "Receiving · A1").
export type AisleOption = { id: string; name: string; zoneName: string };

export function CreateBinDialog({ aisles }: { aisles: AisleOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const form = useForm<CreateBinInput>({
    resolver: zodResolver(createBinSchema),
    defaultValues: { aisleId: '', label: '' },
  });

  function onSubmit(values: CreateBinInput) {
    startTransition(async () => {
      const result = await createBinAction(values);
      if (result.ok) {
        toast.success('Bin created');
        form.reset({ aisleId: '', label: '' });
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const disabled = aisles.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Plus className="size-4" />
          Add bin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a bin</DialogTitle>
          <DialogDescription>
            A single storage slot inside an aisle. Pick the aisle first.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="aisleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aisle</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick an aisle" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {aisles.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.zoneName} · {a.name}
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
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bin label</FormLabel>
                  <FormControl>
                    <Input placeholder="A1-01" {...field} />
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
                {pending ? 'Creating…' : 'Create bin'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
