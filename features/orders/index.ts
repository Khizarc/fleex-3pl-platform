// Public surface of the orders feature. Internal helpers (runAllocation) are
// intentionally not re-exported — callers should go through the service layer.

export { createOrder } from './services/create-order';
export { allocateOrder } from './services/allocate-order';
export { cancelOrder } from './services/cancel-order';
export { listOrders, type OrderListRow } from './services/list-orders';
export { getOrder } from './services/get-order';
export { bulkCreateOrders, type BulkCreateOrdersResult } from './services/bulk-create-orders';

export {
  parseCsv,
  validateRows,
  DEFAULT_CAPS,
  CSV_HEADERS,
  csvOrderRowSchema,
  type CsvHeader,
  type CsvOrderRow,
  type GroupedOrder,
  type RowError,
  type SkuLookup,
  type ValidateCaps,
  type ValidateResult,
  type ParsedCsv,
} from './csv';

export { IllegalStateTransitionError } from './state-machine';
export {
  createOrderInputSchema,
  allocateOrderInputSchema,
  cancelOrderInputSchema,
  orderLineInputSchema,
  type CreateOrderInput,
  type OrderLineInput,
  type AllocateOrderInput,
  type CancelOrderInput,
} from './validation';
