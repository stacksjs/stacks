/**
 * Payments Package
 *
 * Provides payment processing capabilities with Stripe integration.
 */

// Main Payment facade
export * from './payment'
export { default as Payment } from './payment'

// Billable modules
export * from './billable'

// Stripe driver and SDK
export * from './drivers/stripe'
export * as Stripe from 'stripe'

// Idempotency-key helpers — passed to every Stripe create/update so
// retries don't produce duplicate objects (stacksjs/stacks#1876 X-1).
export { freshIdempotencyKey, stacksIdempotencyKey } from './idempotency'
