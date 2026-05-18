// Public surface of the orders feature. Internal helpers (runAllocation) are
// intentionally not re-exported — callers should go through the service layer.

export { createOrder } from './services/create-order';
export { allocateOrder } from './services/allocate-order';
export { cancelOrder } from './services/cancel-order';
export { listOrders, type OrderListRow } from './services/list-orders';
export { getOrder } from './services/get-order';
export { bulkCreateOrders, type BulkCreateOrdersResult } from './services/bulk-create-orders';
export {
  pickAllocation,
  BinLabelMismatchError,
  AllocationAlreadyPickedError,
  BinNotActiveError,
} from './services/pick-allocation';
export { listPickQueue, type PickQueueRow } from './services/list-pick-queue';
export { getPickList, type PickListItem } from './services/get-pick-list';

export { packOrder, OrderAlreadyPackedError } from './services/pack-order';
export { listPackQueue, type PackQueueRow } from './services/list-pack-queue';
export { inchesToMm, ouncesToGrams, mmToInches, gramsToOunces } from './units';

export { shipOrder, OrderAlreadyShippedError } from './services/ship-order';
export { listShipQueue, type ShipQueueRow } from './services/list-ship-queue';

export {
  parseCsv,
  validateRows,
  DEFAULT_CAPS,
  CSV_HEADERS,
  csvOrderRowSchema,
  type CsvHeader,
  type CsvOrderRow,
  type GroupedOrder,
  type GroupedOrderLine,
  type PersonalizationDefinition,
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
  pickAllocationInputSchema,
  packOrderInputSchema,
  shipOrderInputSchema,
  type CreateOrderInput,
  type OrderLineInput,
  type AllocateOrderInput,
  type CancelOrderInput,
  type PickAllocationInput,
  type PackOrderInput,
  type ShipOrderInput,
} from './validation';
