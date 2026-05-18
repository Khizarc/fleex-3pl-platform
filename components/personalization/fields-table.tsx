'use client';

// Shared table of personalization-field definitions. Disable/enable + edit
// actions wired through props so this component is shell-agnostic.

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AccountStatus, type PersonalizationField } from '@prisma/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ActionResult = { ok: true } | { ok: false; error: string };

export function PersonalizationFieldsTable({
  fields,
  disableAction,
  enableAction,
}: {
  fields: PersonalizationField[];
  disableAction: (fieldId: string) => Promise<ActionResult>;
  enableAction: (fieldId: string) => Promise<ActionResult>;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Required</TableHead>
            <TableHead>Sort</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((f) => (
            <FieldRow
              key={f.id}
              field={f}
              disableAction={disableAction}
              enableAction={enableAction}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FieldRow({
  field,
  disableAction,
  enableAction,
}: {
  field: PersonalizationField;
  disableAction: (fieldId: string) => Promise<ActionResult>;
  enableAction: (fieldId: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isActive = field.status === AccountStatus.ACTIVE;

  function toggle() {
    startTransition(async () => {
      const result = isActive ? await disableAction(field.id) : await enableAction(field.id);
      if (result.ok) {
        toast.success(isActive ? 'Field disabled' : 'Field re-enabled');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{field.key}</TableCell>
      <TableCell className="text-sm">{field.label}</TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {field.required ? 'Yes' : '—'}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{field.sortOrder}</TableCell>
      <TableCell>
        <Badge variant={isActive ? 'default' : 'outline'}>{isActive ? 'Active' : 'Disabled'}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" disabled={pending} onClick={toggle}>
          {pending ? 'Working…' : isActive ? 'Disable' : 'Re-enable'}
        </Button>
      </TableCell>
    </TableRow>
  );
}
