import type Stripe from 'stripe'

/**
 * What a Checkout Session webhook means for the thing it was paying for.
 *
 * Four event types and a `payment_status` combine into the four states a
 * handler acts on, and getting the combination wrong is how an order ships
 * unpaid or a member waits forever:
 *
 * | Event                                      | `payment_status`                | Outcome      |
 * |--------------------------------------------|---------------------------------|--------------|
 * | `checkout.session.completed`               | `paid` / `no_payment_required`  | `paid`       |
 * | `checkout.session.completed`               | `unpaid`                        | `processing` |
 * | `checkout.session.async_payment_succeeded` | `paid`                          | `paid`       |
 * | `checkout.session.async_payment_failed`    | any                             | `failed`     |
 * | `checkout.session.expired`                 | any                             | `expired`    |
 *
 * `processing` is a delayed method (SEPA Direct Debit, Bacs, ACH, a bank
 * redirect): the buyer finished, the money has not arrived, and one of the
 * async events follows in a few days. Fulfil on `paid` only.
 *
 * Every other event type is `null`, so a handler can call this first and
 * return early. It reads only the event; verify the signature and match the
 * session to your own record (its id or `client_reference_id`) before acting.
 */
export type CheckoutOutcomeStatus = 'paid' | 'processing' | 'failed' | 'expired'

export interface CheckoutOutcome {
  status: CheckoutOutcomeStatus
  /** The event's session, as sent. */
  session: Stripe.Checkout.Session
  sessionId: string
  /** `client_reference_id`, the id of your record the session was opened for. */
  reference: string | null
  /** The PaymentIntent of a `mode: 'payment'` session, expanded or not. */
  paymentIntentId: string | null
  /** The subscription a `mode: 'subscription'` session created. */
  subscriptionId: string | null
  customerId: string | null
  mode: Stripe.Checkout.Session.Mode | null
  /** `amount_total` in minor units, and its currency (lower case). */
  amountTotal: number | null
  currency: string | null
  metadata: Record<string, string>
}

const PAID: readonly string[] = ['paid', 'no_payment_required']

function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value || null
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') return (value as { id: string }).id || null
  return null
}

/**
 * Read a `checkout.session.*` event into the outcome it stands for, or null
 * for any other event (and for `completed` with a status Stripe may add later).
 *
 * @example
 * const outcome = checkoutOutcome(event)
 * if (!outcome || outcome.metadata.order_id == null) return
 * if (outcome.status === 'paid') await fulfil(outcome.reference, outcome.paymentIntentId)
 * else if (outcome.status === 'failed' || outcome.status === 'expired') await release(outcome.reference)
 */
export function checkoutOutcome(event: { type: string, data?: { object?: unknown } } | null | undefined): CheckoutOutcome | null {
  if (!event || typeof event.type !== 'string' || !event.type.startsWith('checkout.session.')) return null
  const session = event.data?.object as Stripe.Checkout.Session | undefined
  if (!session || typeof session !== 'object' || typeof session.id !== 'string') return null

  const paymentStatus = String(session.payment_status ?? '')
  let status: CheckoutOutcomeStatus | null = null
  switch (event.type) {
    case 'checkout.session.completed':
      status = PAID.includes(paymentStatus) ? 'paid' : paymentStatus === 'unpaid' ? 'processing' : null
      break
    case 'checkout.session.async_payment_succeeded':
      status = PAID.includes(paymentStatus) ? 'paid' : 'processing'
      break
    case 'checkout.session.async_payment_failed':
      status = 'failed'
      break
    case 'checkout.session.expired':
      status = 'expired'
      break
  }
  if (!status) return null

  return {
    status,
    session,
    sessionId: session.id,
    reference: session.client_reference_id ?? null,
    paymentIntentId: idOf(session.payment_intent),
    subscriptionId: idOf(session.subscription),
    customerId: idOf(session.customer),
    mode: session.mode ?? null,
    amountTotal: Number.isFinite(session.amount_total) ? Number(session.amount_total) : null,
    currency: session.currency ? String(session.currency).toLowerCase() : null,
    metadata: (session.metadata ?? {}) as Record<string, string>,
  }
}
