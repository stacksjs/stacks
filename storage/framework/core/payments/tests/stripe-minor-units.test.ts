import type Stripe from 'stripe'
import type { Payer, StripeOperations } from '../src/driver'
import { describe, expect, it } from 'bun:test'
import { StripeDriver } from '../src/driver'

/**
 * stacksjs/stacks#3106. A driver `Money` is in ISO 4217 minor units, which is
 * what commerce stores. Stripe's `amount` disagrees for three currencies: ISK
 * and UGX are written with two decimals there (5 ISK is 500) though ISO gives
 * them none, and MGA has none there though ISO gives it two.
 */
const payer: Payer = { id: 1, email: 'ada@example.com', name: 'Ada' }

function stripeDriver(event?: Record<string, unknown>) {
  const sent: Array<Record<string, any>> = []
  const operations = {
    customer: async () => ({ id: 'cus_1', email: 'ada@example.com', name: 'Ada' }) as Stripe.Customer,
    // Stripe answers in the units it was sent.
    createIntent: async (_payer: Payer, params: Record<string, any>) => {
      sent.push({ kind: 'intent', ...params })
      return { id: 'pi_1', status: 'requires_payment_method', amount: params.amount, currency: params.currency, client_secret: 's' } as Stripe.PaymentIntent
    },
    refund: async (_id: string, params: Record<string, any>) => {
      sent.push({ kind: 'refund', ...params })
      return { id: 're_1', status: 'succeeded', amount: params.amount, currency: 'isk' } as Stripe.Refund
    },
    createCheckout: async (_payer: Payer, params: Record<string, any>) => {
      sent.push({ kind: 'checkout', ...params })
      return { id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1', expires_at: null } as unknown as Stripe.Checkout.Session
    },
    constructEvent: async () => event as unknown as Stripe.Event,
  } as unknown as StripeOperations
  return { driver: new StripeDriver({ operations, webhookSecret: 'whsec_test' }), sent }
}

describe('the Stripe driver converts ISO minor units to Stripe\'s', () => {
  it('sends and reads ISK, UGX and MGA amounts in Stripe\'s units', async () => {
    const { driver, sent } = stripeDriver()
    const cases = [
      { currency: 'ISK', iso: 500, stripe: 50000 },
      { currency: 'ugx', iso: 500, stripe: 50000 },
      { currency: 'MGA', iso: 500000, stripe: 5000 },
      { currency: 'JPY', iso: 1000, stripe: 1000 },
      { currency: 'USD', iso: 1999, stripe: 1999 },
      { currency: 'KWD', iso: 5120, stripe: 5120 },
    ]
    for (const { currency, iso, stripe } of cases) {
      const result = await driver.createPayment(payer, { amount: iso, currency })
      expect(sent.at(-1)!.amount).toBe(stripe)
      expect(result.amount).toEqual({ amount: iso, currency: currency.toLowerCase() })
      await driver.charge(payer, { amount: iso, currency }, 'pm_1')
      expect(sent.at(-1)!.amount).toBe(stripe)
    }
  })

  it('refunds and prices checkout lines in Stripe\'s units', async () => {
    const { driver, sent } = stripeDriver()
    const refund = await driver.refund('pi_1', { amount: { amount: 200, currency: 'ISK' } })
    expect(sent.at(-1)!.amount).toBe(20000)
    expect(refund.amount).toEqual({ amount: 200, currency: 'isk' })

    await driver.checkout(payer, { mode: 'payment', currency: 'MGA', successUrl: 'https://shop.test/ok', lines: [{ name: 'Vanilla', unitAmount: 1250000, quantity: 1 }] })
    expect(sent.at(-1)!.line_items[0].price_data.unit_amount).toBe(12500)
  })

  it('refuses an MGA amount Stripe cannot express', async () => {
    const { driver, sent } = stripeDriver()
    await expect(driver.createPayment(payer, { amount: 500050, currency: 'MGA' })).rejects.toThrow(/MGA/)
    expect(sent).toHaveLength(0)
  })

  it('reads a webhook\'s amount back into ISO minor units', async () => {
    const { driver } = stripeDriver({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1', amount: 50000, currency: 'isk', metadata: {} } } })
    const [event] = await driver.verifyWebhook({ payload: '{}', headers: { 'stripe-signature': 't=1,v1=x' } })
    expect(event!.amount).toEqual({ amount: 500, currency: 'isk' })
  })
})
