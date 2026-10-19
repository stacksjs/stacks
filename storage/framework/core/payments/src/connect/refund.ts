import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { freshIdempotencyKey } from '../idempotency'

/**
 * Refunds that know about Connect.
 *
 * A destination charge gave the money to a merchant. Refunded like any other
 * charge, the buyer is paid back out of the PLATFORM's balance and the
 * merchant keeps the sale; the platform's fee stays taken too. Stripe undoes
 * both only when the refund asks: `reverse_transfer` pulls the refunded share
 * back from the connected account, `refund_application_fee` gives back the
 * platform's proportional cut. Forgetting them is silent, and it is the
 * platform that pays.
 *
 * `isDestinationCharge` and `connectRefundParams` are pure: they read a
 * PaymentIntent (ideally with `latest_charge` expanded) or a Charge you
 * already hold. `connectRefund` retrieves it and creates the refund.
 */

/** A PaymentIntent or Charge, or the parts of one that say where the money went. */
export interface RefundSource {
  id: string
  object?: string
  transfer_data?: { destination?: string | { id?: string } | null } | null
  /** A Charge's transfer to the merchant; set on destination charges. */
  transfer?: string | { id?: string } | null
  /** A PaymentIntent's fee, in minor units. */
  application_fee_amount?: number | null
  /** A Charge's fee object or id. */
  application_fee?: string | { id?: string } | null
  /** A PaymentIntent's charge, when expanded. */
  latest_charge?: string | RefundSource | null
}

export interface ConnectRefundOptions {
  /** Minor units to refund; the whole remaining amount when left out. */
  amount?: number
  reason?: Stripe.RefundCreateParams.Reason
  metadata?: Record<string, string>
  /**
   * Give the platform's fee back in proportion (default true on a
   * destination charge that took one). False keeps the fee: a platform that
   * charges for the work even when the sale is refunded.
   */
  refundApplicationFee?: boolean
  /** Take the refund back from the merchant (default true on a destination charge). */
  reverseTransfer?: boolean
}

function expandedCharge(source: RefundSource): RefundSource | null {
  return source.latest_charge && typeof source.latest_charge === 'object' ? source.latest_charge : null
}

/**
 * True when the money of this PaymentIntent or Charge settled to a connected
 * account: `transfer_data.destination` on either, or a Charge's `transfer`.
 * A PaymentIntent read without `latest_charge` expanded is judged on its own
 * `transfer_data`, which every destination charge carries.
 */
export function isDestinationCharge(source: RefundSource | null | undefined): boolean {
  if (!source) return false
  const charge = expandedCharge(source)
  return Boolean(source.transfer_data?.destination || source.transfer || charge?.transfer_data?.destination || charge?.transfer)
}

/** True when the charge carried a platform fee (so there is a fee to give back). */
export function tookApplicationFee(source: RefundSource | null | undefined): boolean {
  if (!source) return false
  const charge = expandedCharge(source)
  return Boolean((source.application_fee_amount ?? 0) > 0 || source.application_fee || (charge?.application_fee_amount ?? 0) > 0 || charge?.application_fee)
}

/**
 * `stripe.refunds.create` params for refunding `source`, with
 * `reverse_transfer` and `refund_application_fee` set when it was a
 * destination charge (and took a fee, for the second). Refunds by
 * `payment_intent` for a PaymentIntent (`pi_...`) and by `charge` otherwise.
 *
 * @example
 * const intent = await stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] })
 * await stripe.refunds.create(connectRefundParams(intent, { amount: 500 }), { idempotencyKey })
 */
export function connectRefundParams(source: RefundSource, options: ConnectRefundOptions = {}): Stripe.RefundCreateParams {
  if (!source?.id || typeof source.id !== 'string')
    throw new Error('[payments/connect] connectRefundParams needs the PaymentIntent or Charge to refund')
  if (options.amount != null && (!Number.isSafeInteger(options.amount) || options.amount <= 0))
    throw new Error(`[payments/connect] a refund amount is a positive whole number of minor units, got ${options.amount}`)

  const isIntent = source.object === 'payment_intent' || source.id.startsWith('pi_')
  const destination = isDestinationCharge(source)
  const reverse = destination && (options.reverseTransfer ?? true)
  const refundFee = destination && tookApplicationFee(source) && (options.refundApplicationFee ?? true)

  return {
    ...(isIntent ? { payment_intent: source.id } : { charge: source.id }),
    ...(options.amount != null ? { amount: options.amount } : {}),
    ...(options.reason ? { reason: options.reason } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
    ...(reverse ? { reverse_transfer: true } : {}),
    ...(refundFee ? { refund_application_fee: true } : {}),
  }
}

/**
 * Refund a PaymentIntent (`pi_...`) or Charge (`ch_...`, `py_...`), reversing
 * the merchant's transfer and the platform's fee when it was a destination
 * charge. Retrieves the object first (one extra read) to find out.
 *
 * Pass a deterministic `idempotencyKey` (your refund row's id, say) so a
 * retried request cannot refund twice; without one each call is a new refund.
 */
export async function connectRefund(
  paymentId: string,
  options: ConnectRefundOptions & { idempotencyKey?: string } = {},
): Promise<Stripe.Response<Stripe.Refund>> {
  if (!paymentId || typeof paymentId !== 'string')
    throw new Error('[payments/connect] connectRefund needs a PaymentIntent or Charge id')
  const { idempotencyKey, ...refundOptions } = options
  const source: RefundSource = paymentId.startsWith('pi_')
    ? await stripe.paymentIntents.retrieve(paymentId, { expand: ['latest_charge'] }) as unknown as RefundSource
    : await stripe.charges.retrieve(paymentId) as unknown as RefundSource
  return await stripe.refunds.create(connectRefundParams(source, refundOptions), {
    idempotencyKey: idempotencyKey ?? freshIdempotencyKey('connect.refund', paymentId, refundOptions.amount ?? 'full'),
  })
}
