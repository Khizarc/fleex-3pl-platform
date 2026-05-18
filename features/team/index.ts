// Public surface of the team-management feature (Milestone 1.11).

export { listStaff, type StaffRow } from './services/list-staff';
export { inviteStaff, StaffEmailAlreadyExistsError } from './services/invite-staff';
export { updateStaffRole, CannotChangeOwnRoleError } from './services/update-staff-role';
export { updateStaffStatus, CannotChangeOwnStatusError } from './services/update-staff-status';
export {
  assignOrder,
  CannotAssignTerminalOrderError,
  InvalidAssigneeError,
} from './services/assign-order';
export {
  assertNotLastActiveAdmin,
  LastActiveAdminError,
} from './services/assert-not-last-active-admin';

export {
  inviteStaffInputSchema,
  updateStaffRoleInputSchema,
  updateStaffStatusInputSchema,
  assignOrderInputSchema,
  type InviteStaffInput,
  type UpdateStaffRoleInput,
  type UpdateStaffStatusInput,
  type AssignOrderInput,
} from './validation';
