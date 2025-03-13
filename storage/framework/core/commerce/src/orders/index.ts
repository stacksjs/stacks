// Export all order functions

// Delete operations
export {
  bulkDestroy,
  bulkSoftDelete,
  destroy,
  softDelete,
} from './destroy'

// Export operations
export {
  downloadOrders,
  exportOrders,
  storeOrdersExport,
} from './export'

// Fetch operations
export {
  calculateOrderMetrics,
  compareOrdersByPeriod,
  fetchAll,
  fetchById,
  fetchDailyOrderTrends,
  fetchStats,
} from './fetch'
