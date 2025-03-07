// Export types
export type {
  NewOrder,
  OrderItemForCalculation,
  OrderResponse,
  OrderStats,
  OrderTotals,
  OrderType,
  OrderTypeCount,
  StatusCount,
} from '../../types'

// Export delete functionality
export {
  bulkDestroy,
  bulkSoftDelete,
  destroy,
  softDelete,
} from './destroy'

// Export fetch functionality
export {
  fetchAll,
  fetchByCustomer,
  fetchById,
  fetchByStatus,
  type FetchOrdersOptions,
  fetchPaginated,
  fetchStats,
} from './fetch'

// Export store functionality
export {
  bulkStore,
  calculateOrderTotals,
  store,
} from './store'
