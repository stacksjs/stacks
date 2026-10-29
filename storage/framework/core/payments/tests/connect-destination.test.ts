import type Stripe from 'stripe'
import { describe, expect, test } from 'bun:test'
import { checkoutOutcome } from '../src/checkout-outcome'
import {
  checkoutLineItemsTotal,
  destinationCheckoutPaymentData,
  destinationCheckoutSubscriptionData,
  destinationFeeCents,
  destinationFeePercent,
  destinationPaymentIntentParams,
  destinationSubscriptionParams,
  splitFee,
} from '../src/connect/destination'
import { connectRefund, connectRefundParams, isDestinationCharge, tookApplicationFee } from '../src/connect/refund'

const destination = 'acct_gym'

describe('destinationFeeCents', () => {
  test('floors by default, rounds when asked', () => {
    expect(destinationFeeCents(1999, { feePercent: 7.5 })).toBe(149)
    expect(destinationFeeCents(1999, { feePercent: 7.5, rounding: 'round' })).toBe(150)
    expect(destinationFeeCents(1999, { feePercent: 7.5, rounding: 'floor' })).toBe(149)
  })

  test('snaps float noise before flooring', () => {
    // 375 * 18.4 / 100 computes as 68.99999999999999.
    expect(destinationFeeCents(375, { feePercent: 18.4 })).toBe(69)
  })

  test('an exact fee wins over a percent', () => {
    expect(destinationFeeCents(5000, { feeCents: 250, feePercent: 50 })).toBe(250)
  })

  test('nothing configured takes nothing', () => {
    expect(destinationFeeCents(5000)).toBe(0)
    expect(destinationFeeCents(5000, { feePercent: 0 })).toBe(0)
  })

  test('never exceeds the charge, and refuses nonsense', () => {
    expect(destinationFeeCents(1, { feePercent: 100, rounding: 'round' })).toBe(1)
    expect(() => destinationFeeCents(100, { feeCents: 101 })).toThrow(/exceeds/)
    expect(() => destinationFeeCents(100, { feeCents: 1.5 })).toThrow(/whole number/)
    expect(() => destinationFeeCents(100, { feePercent: 101 })).toThrow(/between 0 and 100/)
    expect(() => destinationFeeCents(100, { feePercent: -1 })).toThrow(/between 0 and 100/)
    expect(() => destinationFeeCents(99.5, { feePercent: 1 })).toThrow(/minor units/)
    expect(() => destinationFeeCents(100, { feePercent: 1, rounding: 'ceil' as never })).toThrow(/rounding/)
  })
})

describe('destinationFeePercent', () => {
  test('keeps two decimals, snaps float sums, and refuses finer', () => {
    expect(destinationFeePercent({ feePercent: 2.5 })).toBe(2.5)
    expect(destinationFeePercent({ feePercent: 0.1 + 0.2 })).toBe(0.3)
    expect(destinationFeePercent({ feePercent: 0 })).toBeUndefined()
    expect(destinationFeePercent({})).toBeUndefined()
    expect(() => destinationFeePercent({ feePercent: 2.555 })).toThrow(/two decimal/)
    expect(() => destinationFeePercent({ feeCents: 100 })).toThrow(/feePercent/)
  })
})

describe('destination params', () => {
  test('a PaymentIntent settles to the merchant less the fee', () => {
    const params = destinationPaymentIntentParams(4900, { destination, feePercent: 10, onBehalfOf: true, transferGroup: 'order_7' })
    expect(params).toEqual({ transfer_data: { destination }, on_behalf_of: destination, application_fee_amount: 490, transfer_group: 'order_7' })
    // Typed as the Stripe create params it spreads into.
    const create: Stripe.PaymentIntentCreateParams = { amount: 4900, currency: 'eur', ...params }
    expect(create.transfer_data?.destination).toBe(destination)
  })

  test('no fee sends no fee field', () => {
    expect(destinationPaymentIntentParams(4900, { destination })).toEqual({ transfer_data: { destination } })
  })

  test('Checkout payment data merges extra fields and keeps Connect fields authoritative', () => {
    const data = destinationCheckoutPaymentData(2000, { destination, feeCents: 100 }, { metadata: { order_id: '9' }, application_fee_amount: 5, transfer_data: { destination: 'acct_other' } })
    expect(data).toEqual({ metadata: { order_id: '9' }, transfer_data: { destination }, application_fee_amount: 100 })
  })

  test('Checkout subscription data carries a percent', () => {
    const data = destinationCheckoutSubscriptionData({ destination, feePercent: 3 }, { metadata: { membership_id: '4' }, trial_period_days: 14 })
    expect(data).toEqual({ metadata: { membership_id: '4' }, trial_period_days: 14, transfer_data: { destination }, application_fee_percent: 3 })
    expect(() => destinationCheckoutSubscriptionData({ destination, feeCents: 300 })).toThrow(/feePercent/)
  })

  test('a direct subscription carries a percent', () => {
    const params = destinationSubscriptionParams({ destination, feePercent: 1.25, onBehalfOf: true })
    expect(params).toEqual({ transfer_data: { destination }, on_behalf_of: destination, application_fee_percent: 1.25 })
    const create: Stripe.SubscriptionCreateParams = { customer: 'cus_1', items: [{ price: 'price_1' }], ...params }
    expect(create.application_fee_percent).toBe(1.25)
  })

  test('refuses an id that is not a connected account', () => {
    expect(() => destinationPaymentIntentParams(100, { destination: 'cus_1' })).toThrow(/acct_/)
    expect(() => destinationSubscriptionParams({ destination: '' })).toThrow(/connected account/)
  })
})

describe('checkoutLineItemsTotal', () => {
  test('sums price_data lines and refuses catalog prices', () => {
    expect(checkoutLineItemsTotal([
      { quantity: 1, price_data: { currency: 'eur', unit_amount: 4900, product_data: { name: 'Plan' } } },
      { quantity: 2, price_data: { currency: 'eur', unit_amount: 1000, product_data: { name: 'Joining fee' } } },
    ])).toBe(6900)
    expect(() => checkoutLineItemsTotal([{ price: 'price_1', quantity: 1 }])).toThrow(/catalog price/)
  })
})

describe('splitFee', () => {
  test('shares always add up to the amount', () => {
    expect(splitFee(101, { tip: 2, planet: 1 })).toEqual({ tip: 67, planet: 34 })
    expect(splitFee(100, { a: 1, b: 1, c: 1 })).toEqual({ a: 34, b: 33, c: 33 })
    for (let amount = 0; amount < 500; amount += 7) {
      const shares = splitFee(amount, { tip: 3.5, planet: 1.25, ops: 0.4 })
      expect(shares.tip + shares.planet + shares.ops).toBe(amount)
    }
  })

  test('a negative amount (a refunded fee) splits the same way, negated', () => {
    expect(splitFee(-101, { tip: 2, planet: 1 })).toEqual({ tip: -67, planet: -34 })
  })

  test('all-zero weights give everything to the fallback', () => {
    expect(splitFee(50, { tip: 0, planet: 0 })).toEqual({ tip: 50, planet: 0 })
    // The fallback names one of the shares; it does not decide which they are.
    expect(splitFee(50, { planet: 0, tip: 0 }, 'tip')).toEqual({ planet: 0, tip: 50 })
    expect(splitFee(50, { tip: 0, planet: 0 }, 'planet')).toEqual({ tip: 0, planet: 50 })
  })

  test('refuses bad input', () => {
    expect(() => splitFee(1.5, { a: 1 })).toThrow(/whole number/)
    expect(() => splitFee(10, {})).toThrow(/at least one/)
    expect(() => splitFee(10, { a: -1 })).toThrow(/non-negative/)
    expect(() => splitFee(10, { a: 1 }, 'b' as 'a')).toThrow(/fallback/)
  })
})

describe('Connect refunds', () => {
  const destinationIntent = { id: 'pi_1', object: 'payment_intent', transfer_data: { destination }, application_fee_amount: 50 }

  test('recognises a destination charge on the intent, its expanded charge, or a charge', () => {
    expect(isDestinationCharge(destinationIntent)).toBe(true)
    expect(isDestinationCharge({ id: 'pi_2', latest_charge: { id: 'ch_2', transfer: 'tr_1' } })).toBe(true)
    expect(isDestinationCharge({ id: 'ch_3', transfer_data: { destination: { id: destination } } })).toBe(true)
    expect(isDestinationCharge({ id: 'pi_4', transfer_data: null, latest_charge: 'ch_4' })).toBe(false)
    expect(isDestinationCharge(null)).toBe(false)
    expect(tookApplicationFee({ id: 'ch_5', application_fee: 'fee_1' })).toBe(true)
    expect(tookApplicationFee({ id: 'pi_6', application_fee_amount: 0 })).toBe(false)
  })

  test('a destination charge reverses the transfer and refunds the fee', () => {
    expect(connectRefundParams(destinationIntent, { amount: 500, reason: 'requested_by_customer', metadata: { refund: '3' } })).toEqual({
      payment_intent: 'pi_1',
      amount: 500,
      reason: 'requested_by_customer',
      metadata: { refund: '3' },
      reverse_transfer: true,
      refund_application_fee: true,
    })
  })

  test('no fee taken means no fee to refund, and the platform can keep its fee', () => {
    expect(connectRefundParams({ id: 'ch_1', transfer: 'tr_1' })).toEqual({ charge: 'ch_1', reverse_transfer: true })
    expect(connectRefundParams(destinationIntent, { refundApplicationFee: false })).toEqual({ payment_intent: 'pi_1', reverse_transfer: true })
  })

  test('a platform charge refunds plainly', () => {
    expect(connectRefundParams({ id: 'pi_9', transfer_data: null })).toEqual({ payment_intent: 'pi_9' })
    expect(connectRefundParams({ id: 'py_9' })).toEqual({ charge: 'py_9' })
  })

  test('refuses a bad amount or a missing source', () => {
    expect(() => connectRefundParams(destinationIntent, { amount: 0 })).toThrow(/positive/)
    expect(() => connectRefundParams({} as never)).toThrow(/PaymentIntent or Charge/)
  })
})

describe('checkoutOutcome', () => {
  const session = (fields: Record<string, unknown>) => ({ id: 'cs_1', object: 'checkout.session', client_reference_id: '42', mode: 'payment', amount_total: 4900, currency: 'EUR', metadata: { order_id: '42' }, ...fields })
  const event = (type: string, fields: Record<string, unknown>) => ({ type, data: { object: session(fields) } })

  test('completed and paid (or free) is paid', () => {
    const outcome = checkoutOutcome(event('checkout.session.completed', { payment_status: 'paid', payment_intent: 'pi_1', customer: { id: 'cus_1' } }))!
    expect(outcome.status).toBe('paid')
    expect(outcome).toMatchObject({ sessionId: 'cs_1', reference: '42', paymentIntentId: 'pi_1', customerId: 'cus_1', subscriptionId: null, amountTotal: 4900, currency: 'eur', mode: 'payment', metadata: { order_id: '42' } })
    expect(checkoutOutcome(event('checkout.session.completed', { payment_status: 'no_payment_required' }))!.status).toBe('paid')
  })

  test('completed but unpaid is a delayed method still processing', () => {
    const outcome = checkoutOutcome(event('checkout.session.completed', { payment_status: 'unpaid', mode: 'subscription', subscription: { id: 'sub_1' } }))!
    expect(outcome.status).toBe('processing')
    expect(outcome.subscriptionId).toBe('sub_1')
  })

  test('saving a payment method or an unknown checkout mode never establishes a payment outcome', () => {
    for (const mode of ['setup', null, undefined, 'future_mode']) {
      for (const type of ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'])
        expect(checkoutOutcome(event(type, { mode, payment_status: 'no_payment_required' }))).toBeNull()
    }
  })

  test('the async events and expiry', () => {
    expect(checkoutOutcome(event('checkout.session.async_payment_succeeded', { payment_status: 'paid' }))!.status).toBe('paid')
    expect(checkoutOutcome(event('checkout.session.async_payment_failed', { payment_status: 'unpaid' }))!.status).toBe('failed')
    expect(checkoutOutcome(event('checkout.session.expired', { payment_status: 'unpaid' }))!.status).toBe('expired')
  })

  test('anything else is null', () => {
    expect(checkoutOutcome(event('payment_intent.succeeded', {}))).toBeNull()
    expect(checkoutOutcome({ type: 'checkout.session.completed', data: {} })).toBeNull()
    expect(checkoutOutcome(event('checkout.session.completed', { payment_status: 'something_new' }))).toBeNull()
    expect(checkoutOutcome(null)).toBeNull()
  })
})

describe('connectRefund', () => {
  test('refunds through the client it is given, reading the payment first', async () => {
    const calls: string[] = []
    const client = {
      paymentIntents: { retrieve: async (id: string) => { calls.push(`retrieve ${id}`); return { id, object: 'payment_intent', transfer_data: { destination: 'acct_1' }, application_fee_amount: 30 } } },
      charges: { retrieve: async (id: string) => { calls.push(`charge ${id}`); return { id, object: 'charge' } } },
      refunds: { create: async (params: any, options: any) => { calls.push(`refund ${JSON.stringify(params)} ${options.idempotencyKey}`); return { id: 're_1' } } },
    } as unknown as Pick<Stripe, 'paymentIntents' | 'charges' | 'refunds'>
    await connectRefund('pi_1', { amount: 500, idempotencyKey: 'key-1', client })
    expect(calls[0]).toBe('retrieve pi_1')
    expect(calls[1]).toContain('"payment_intent":"pi_1"')
    expect(calls[1]).toContain('"reverse_transfer":true')
    expect(calls[1]).toContain('"refund_application_fee":true')
    expect(calls[1]).toEndWith('key-1')
  })
})
