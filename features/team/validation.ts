// Zod schemas for the team-management surface (Milestone 1.11).

import { AccountStatus, Role } from '@prisma/client';
import { z } from 'zod';

export const inviteStaffInputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  name: z.string().trim().min(1, 'Name is required').max(120),
  role: z.nativeEnum(Role),
});

export const updateStaffRoleInputSchema = z.object({
  userId: z.string().min(1),
  role: z.nativeEnum(Role),
});

export const updateStaffStatusInputSchema = z.object({
  userId: z.string().min(1),
  status: z.nativeEnum(AccountStatus),
});

// Per-order assignment: assignedToUserId === null means "unassign".
export const assignOrderInputSchema = z.object({
  orderId: z.string().min(1),
  assignedToUserId: z.string().min(1).nullable(),
});

export type InviteStaffInput = z.infer<typeof inviteStaffInputSchema>;
export type UpdateStaffRoleInput = z.infer<typeof updateStaffRoleInputSchema>;
export type UpdateStaffStatusInput = z.infer<typeof updateStaffStatusInputSchema>;
export type AssignOrderInput = z.infer<typeof assignOrderInputSchema>;
