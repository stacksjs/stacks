export {
  bulkDestroy,
  bulkSoftDelete,
  destroy,
  softDelete,
} from './destroy'

export {
  downloadOrders,
  exportOrders,
  storeOrdersExport,
} from './export'

export {
  calculateOrderMetrics,
  compareOrdersByPeriod,
  fetchAll,
  fetchById,
  fetchDailyOrderTrends,
  fetchStats,
} from './fetch'

export {
  store,
} from './store'

// Atomic order placement (stacksjs/stacks#1879 Co-1).
// Wraps order + payment + inventory decrement in a single
// transaction so any failure rolls back the rest.
export { placeOrder } from './place-order'
export type { PlaceOrderInput, PlaceOrderResult } from './place-order'

export {
  update,
  updateDeliveryInfo,
  updateStatus,
} from './update'
