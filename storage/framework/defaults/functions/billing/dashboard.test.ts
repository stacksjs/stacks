import { afterEach, describe, expect, it } from 'bun:test'
import { fetchBillingOverview } from './dashboard'

/**
 * The billing page reads what BillingShowAction sends: the stored subscription
 * row beside the payment driver's `SubscriptionSummary`, and the driver's
 * `StoredPaymentMethod`s - JSON, so dates arrive as ISO strings. It used to
 * read Stripe's own objects (`items.data[0].price`, `current_period_end`),
 * which the driver no longer passes to a browser.
 */
const realFetch = globalThis.fetch

function serve(payload: unknown): void {
  globalThis.fetch = (async () => Response.json(payload)) as unknown as typeof fetch
}

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('fetchBillingOverview', () => {
  it('reads the plan, amount and period from the driver\'s subscription summary', async () => {
    serve({
      subscription: {
        subscription: { id: 4, type: 'default', provider_id: 'sub_1', provider_status: 'active' },
        providerSubscription: {
          id: 'sub_1',
          status: 'active',
          price: { id: 'price_pro', name: 'Pro monthly', amount: { amount: 2900, currency: 'eur' }, interval: 'month' },
          currentPeriodEnd: '2026-11-05T00:00:00.000Z',
          cancelAtPeriodEnd: true,
        },
      },
      paymentMethods: [],
      transactions: [],
    })

    const { subscription } = await fetchBillingOverview()
    expect(subscription).toEqual({
      // The provider's id: what cancelling the subscription takes.
      id: 'sub_1',
      plan: 'default',
      type: 'default',
      status: 'active',
      amount: 2900,
      currency: 'eur',
      periodEnd: '2026-11-05T00:00:00.000Z',
      cancelAtPeriodEnd: true,
    })
  })

  it('reads the driver\'s stored payment methods, default included', async () => {
    serve({
      subscription: null,
      paymentMethods: [
        { id: 'pm_1', type: 'card', brand: 'visa', last4: '4242', expMonth: 4, expYear: 2030, isDefault: false },
        { id: 'pm_2', type: 'card', brand: 'amex', last4: '0005', expMonth: 1, expYear: 2031, isDefault: true },
      ],
      transactions: [],
    })

    const { paymentMethods, subscription } = await fetchBillingOverview()
    expect(subscription).toBeNull()
    expect(paymentMethods).toEqual([
      { id: 'pm_1', brand: 'visa', lastFour: '4242', expMonth: 4, expYear: 2030, isDefault: false },
      { id: 'pm_2', brand: 'amex', lastFour: '0005', expMonth: 1, expYear: 2031, isDefault: true },
    ])
  })
})
