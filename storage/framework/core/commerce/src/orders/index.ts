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

// Event bus integration + status-transition state machine
// (stacksjs/stacks#1879 Co-18, Co-4). Emit helpers fire
// order:created / order:paid / order:shipped / order:delivered /
// order:cancelled / order:refunded for downstream subscribers;
// `canTransition` rejects illegal state changes.
export {
  canTransition,
  emitForStatus,
  emitOrderCancelled,
  emitOrderCreated,
  emitOrderDelivered,
  emitOrderPaid,
  emitOrderRefunded,
  emitOrderShipped,
} from './events'
export type { OrderStatus } from './events'

export {
  update,
  updateDeliveryInfo,
  updateStatus,
} from './update'

// Stripe webhook handlers (stacksjs/stacks#1879 Co-17). Call
// registerCommerceWebhookHandlers() once at boot; the payments
// package's processWebhook() verifies signatures + dispatches.
export {
  handleChargeRefunded,
  handlePaymentIntentFailed,
  handlePaymentIntentSucceeded,
  registerCommerceWebhookHandlers,
} from './webhook'

// Server-side cart-to-order total recompute (stacksjs/stacks#1879 Co-13).
// Apps pre-flight the cart through this before placeOrder to detect
// client-supplied drift and reject "price changed" cases.
export { recomputeOrderTotals } from './totals'
export type {
  RecomputeLineItem,
  RecomputeOrderInput,
  RecomputeOrderResult,
} from './totals'

// Cart / order policy guards (stacksjs/stacks#1879 Co-7, Co-14, Co-15).
// Pre-flight the cart through these before placeOrder; abandoned-
// cart cleanup runs as a scheduled job.
export {
  cleanupAbandonedCarts,
  validateCartQuantities,
  validateCouponStacking,
  validateQuantityBounds,
} from './guards'
export type {
  CleanupAbandonedCartsOptions,
  CleanupAbandonedCartsResult,
  CouponStackingPolicy,
  CouponStackingResult,
  QuantityBoundsResult,
} from './guards'
