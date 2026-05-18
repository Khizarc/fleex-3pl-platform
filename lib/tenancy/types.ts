// The two-level tenant context (see docs/ARCHITECTURE.md §3).
//
//   companyId: the owning 3PL Company. Always set when there's any tenant context.
//   clientId:  set only for Client Portal requests, restricting visibility to a
//              single Client's own rows. Omitted for Warehouse Dashboard (staff)
//              requests so they see every client of their company.
export type TenantContext = {
  companyId: string;
  clientId?: string;
};
