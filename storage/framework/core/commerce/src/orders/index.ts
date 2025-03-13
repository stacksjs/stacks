// Export all order functions

// Fetch operations
export {
  fetchAll,
  fetchById,
  fetchStats,
  compareOrdersByPeriod,
  calculateOrderMetrics,
  fetchDailyOrderTrends
} from './fetch'

// Delete operations
export {
  destroy,
  softDelete,
  bulkDestroy,
  bulkSoftDelete
} from './destroy'

// Export operations
export {
  exportOrders,
  downloadOrders,
  storeOrdersExport
} from './export'