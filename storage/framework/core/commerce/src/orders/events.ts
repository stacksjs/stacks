/**
 * Commerce → events bus integration (stacksjs/stacks#1879 Co-18).
 *
 * Background: orders moved through created → paid → shipped →
 * delivered states with no `events.dispatch(...)` calls. Every
 * downstream service (email confirmation, inventory replenishment,
 * analytics, fraud detection) had to poll the orders table because
 * there was no subscription path. The framework's event bus from
 * `@stacksjs/events` has been ready since #1878 — commerce just
 * wasn't wired into it.
 *
 * This module wraps the dispatch calls so they:
 *   - Lazy-import the events package so commerce stays usable in
 *     environments that don't load it (CLI scripts, migrations)
 *   - Silently no-op when the events package isn't installed
 *   - Use a structured payload shape callers can subscribe with type safety
 *   - Never throw — emission failures shouldn't abort the order write
 *
 * Status-transition guard (stacksjs/stacks#1879 Co-4) lives here
 * too so the rules are co-located with the events they trigger.
 */

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'

/**
 * Whitelisted state transitions. Forward-only progressions and
 * branch-to-cancel/refund from any non-terminal state. SHIPPED →
 * PENDING and similar nonsense are rejected.
 *
 * REFUNDED and DELIVERED are terminal — nothing transitions out
 * of them. CANCELLED can be re-entered (rare admin recovery), so
 * we allow CANCELLED → PROCESSING but not the other terminals.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED', 'REFUNDED'],
  DELIVERED: ['REFUNDED'], // post-delivery refund is the only legal exit
  CANCELLED: ['PROCESSING'], // admin recovery — rare but supported
  REFUNDED: [], // terminal
}

/**
 * Check whether `from → to` is a legal status transition
 * (stacksjs/stacks#1879 Co-4). Use in `updateStatus` to reject
 * illegal jumps like SHIPPED → PENDING before they hit the database.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true // no-op
  return TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Best-effort event dispatch. Catches the lazy-import miss (events
 * package not installed) and any per-listener throw — order writes
 * MUST NOT depend on the events bus's health.
 */
async function emitOrderEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const mod = await import('@stacksjs/events').catch(() => null)
    if (!mod) return
    const dispatch = (mod as { dispatch?: (t: string, p: unknown) => void }).dispatch
    if (typeof dispatch !== 'function') return
    dispatch(eventName, payload)
  }
  catch {
    // Swallow — the events bus is a notification side-channel, not
    // the source of truth. A listener that throws shouldn't be able
    // to abort an order write. The events package itself logs handler
    // errors via #1876 O-2 / #1878 E-1 paths.
  }
}

/** Emit `order:created` after a successful placeOrder / store call. */
export async function emitOrderCreated(order: Record<string, unknown>): Promise<void> {
  await emitOrderEvent('order:created', { order })
}

/** Emit `order:paid` after payment confirmation lands. */
export async function emitOrderPaid(order: Record<string, unknown>, payment?: Record<string, unknown>): Promise<void> {
  await emitOrderEvent('order:paid', { order, payment })
}

/** Emit `order:shipped` after fulfillment marks the order shipped. */
export async function emitOrderShipped(order: Record<string, unknown>): Promise<void> {
  await emitOrderEvent('order:shipped', { order })
}

/** Emit `order:delivered` after the carrier confirms delivery. */
export async function emitOrderDelivered(order: Record<string, unknown>): Promise<void> {
  await emitOrderEvent('order:delivered', { order })
}

/** Emit `order:cancelled` on cancellation (pre- or post-payment). */
export async function emitOrderCancelled(order: Record<string, unknown>, reason?: string): Promise<void> {
  await emitOrderEvent('order:cancelled', { order, reason })
}

/** Emit `order:refunded` after a refund settles. */
export async function emitOrderRefunded(order: Record<string, unknown>, refundAmount?: number): Promise<void> {
  await emitOrderEvent('order:refunded', { order, refundAmount })
}

/**
 * Convenience dispatch keyed by status. Used from `updateStatus`
 * so a single function fires the right event for whichever status
 * we just transitioned into.
 */
export async function emitForStatus(status: OrderStatus, order: Record<string, unknown>): Promise<void> {
  switch (status) {
    case 'PROCESSING': return emitOrderPaid(order)
    case 'SHIPPED': return emitOrderShipped(order)
    case 'DELIVERED': return emitOrderDelivered(order)
    case 'CANCELLED': return emitOrderCancelled(order)
    case 'REFUNDED': return emitOrderRefunded(order)
    // PENDING fires no event — the initial state is already covered
    // by `order:created` from the placeOrder path.
    case 'PENDING':
    default:
  }
}
