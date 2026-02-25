/**
 * Stripe Webhook Handler
 *
 * Handles incoming Stripe webhook events and dispatches them to appropriate handlers.
 */

import type Stripe from 'stripe'
import { stripe } from '..'

export type WebhookEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.created'
  | 'payment_intent.canceled'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'customer.subscription.trial_will_end'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'invoice.finalized'
  | 'invoice.created'
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'charge.dispute.closed'
  | 'payment_method.attached'
  | 'payment_method.detached'
  | 'setup_intent.succeeded'
  | 'setup_intent.setup_failed'
  | string

export type WebhookHandler = (_event: Stripe.Event) => Promise<void> | void

export interface WebhookConfig {
  secret: string
  tolerance?: number
}

const handlers: Map<WebhookEventType, WebhookHandler[]> = new Map()

/**
 * Register a webhook event handler
 */
export function onWebhookEvent(eventType: WebhookEventType, handler: WebhookHandler): void {
  const existing = handlers.get(eventType) || []
  existing.push(handler)
  handlers.set(eventType, existing)
}

/**
 * Register multiple webhook handlers at once
 */
export function registerWebhookHandlers(handlerMap: Record<WebhookEventType, WebhookHandler>): void {
  for (const [eventType, handler] of Object.entries(handlerMap)) {
    onWebhookEvent(eventType, handler)
  }
}

/**
 * Construct and verify a webhook event from the raw request
 */
export function constructEvent(
  payload: string | Buffer,
  signature: string,
  secret: string,
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret)
}

/**
 * Handle an incoming webhook event
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<{ handled: boolean, eventType: string, errors?: string[] }> {
  const eventHandlers = handlers.get(event.type) || []

  if (eventHandlers.length === 0) {
    return { handled: false, eventType: event.type }
  }

  const errors: string[] = []

  for (const handler of eventHandlers) {
    try {
      await handler(event)
    }
    catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  return {
    handled: true,
    eventType: event.type,
    ...(errors.length > 0 ? { errors } : {}),
  }
}

/**
 * Process a webhook request
 */
export async function processWebhook(
  payload: string | Buffer,
  signature: string,
  config: WebhookConfig,
): Promise<{ success: boolean, eventType?: string, error?: string }> {
  try {
    const event = constructEvent(payload, signature, config.secret)
    const result = await handleWebhookEvent(event)

    return {
      success: true,
      eventType: result.eventType,
    }
  }
  catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// =============================================================================
// Convenience Handlers Registration
// =============================================================================

/**
 * Register payment intent handlers
 */
export function onPaymentIntent(handlers: {
  succeeded?: WebhookHandler
  failed?: WebhookHandler
  created?: WebhookHandler
  canceled?: WebhookHandler
}): void {
  if (handlers.succeeded) onWebhookEvent('payment_intent.succeeded', handlers.succeeded)
  if (handlers.failed) onWebhookEvent('payment_intent.payment_failed', handlers.failed)
  if (handlers.created) onWebhookEvent('payment_intent.created', handlers.created)
  if (handlers.canceled) onWebhookEvent('payment_intent.canceled', handlers.canceled)
}

/**
 * Register subscription handlers
 */
export function onSubscription(handlers: {
  created?: WebhookHandler
  updated?: WebhookHandler
  deleted?: WebhookHandler
  trialWillEnd?: WebhookHandler
}): void {
  if (handlers.created) onWebhookEvent('customer.subscription.created', handlers.created)
  if (handlers.updated) onWebhookEvent('customer.subscription.updated', handlers.updated)
  if (handlers.deleted) onWebhookEvent('customer.subscription.deleted', handlers.deleted)
  if (handlers.trialWillEnd) onWebhookEvent('customer.subscription.trial_will_end', handlers.trialWillEnd)
}

/**
 * Register invoice handlers
 */
export function onInvoice(handlers: {
  paid?: WebhookHandler
  paymentFailed?: WebhookHandler
  created?: WebhookHandler
  finalized?: WebhookHandler
}): void {
  if (handlers.paid) onWebhookEvent('invoice.paid', handlers.paid)
  if (handlers.paymentFailed) onWebhookEvent('invoice.payment_failed', handlers.paymentFailed)
  if (handlers.created) onWebhookEvent('invoice.created', handlers.created)
  if (handlers.finalized) onWebhookEvent('invoice.finalized', handlers.finalized)
}

/**
 * Register checkout session handlers
 */
export function onCheckout(handlers: {
  completed?: WebhookHandler
  expired?: WebhookHandler
}): void {
  if (handlers.completed) onWebhookEvent('checkout.session.completed', handlers.completed)
  if (handlers.expired) onWebhookEvent('checkout.session.expired', handlers.expired)
}

/**
 * Register charge handlers
 */
export function onCharge(handlers: {
  succeeded?: WebhookHandler
  failed?: WebhookHandler
  refunded?: WebhookHandler
  disputed?: WebhookHandler
}): void {
  if (handlers.succeeded) onWebhookEvent('charge.succeeded', handlers.succeeded)
  if (handlers.failed) onWebhookEvent('charge.failed', handlers.failed)
  if (handlers.refunded) onWebhookEvent('charge.refunded', handlers.refunded)
  if (handlers.disputed) onWebhookEvent('charge.dispute.created', handlers.disputed)
}

// =============================================================================
// Event Data Extractors
// =============================================================================

/**
 * Extract payment intent from event
 */
export function getPaymentIntent(event: Stripe.Event): Stripe.PaymentIntent | null {
  if (event.type.startsWith('payment_intent.')) {
    return event.data.object as Stripe.PaymentIntent
  }
  return null
}

/**
 * Extract subscription from event
 */
export function getSubscription(event: Stripe.Event): Stripe.Subscription | null {
  if (event.type.startsWith('customer.subscription.')) {
    return event.data.object as Stripe.Subscription
  }
  return null
}

/**
 * Extract invoice from event
 */
export function getInvoice(event: Stripe.Event): Stripe.Invoice | null {
  if (event.type.startsWith('invoice.')) {
    return event.data.object as Stripe.Invoice
  }
  return null
}

/**
 * Extract checkout session from event
 */
export function getCheckoutSession(event: Stripe.Event): Stripe.Checkout.Session | null {
  if (event.type.startsWith('checkout.session.')) {
    return event.data.object as Stripe.Checkout.Session
  }
  return null
}

/**
 * Extract charge from event
 */
export function getCharge(event: Stripe.Event): Stripe.Charge | null {
  if (event.type.startsWith('charge.')) {
    return event.data.object as Stripe.Charge
  }
  return null
}

/**
 * Extract customer from event
 */
export function getCustomer(event: Stripe.Event): Stripe.Customer | null {
  if (event.type.startsWith('customer.') && !event.type.includes('subscription')) {
    return event.data.object as Stripe.Customer
  }
  return null
}

export const manageWebhook = {
  onWebhookEvent,
  registerWebhookHandlers,
  constructEvent,
  handleWebhookEvent,
  processWebhook,
  onPaymentIntent,
  onSubscription,
  onInvoice,
  onCheckout,
  onCharge,
  getPaymentIntent,
  getSubscription,
  getInvoice,
  getCheckoutSession,
  getCharge,
  getCustomer,
}
