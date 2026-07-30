import { describe, expect, it } from 'bun:test'
import { billingReadFailures, serializeBillingTransaction, settleBillableRead } from './BillingShowAction'

describe('BillingShowAction helpers', () => {
  it('reports only rejected provider reads', () => {
    expect(billingReadFailures([
      { label: 'Active plan', result: { status: 'fulfilled', value: null } },
      { label: 'Payment methods', result: { status: 'rejected', reason: new Error('Stripe is not configured') } },
    ])).toEqual(['Payment methods: Stripe is not configured'])
  })

  it('serializes only the PaymentTransaction fields exposed to the dashboard', () => {
    const values: Record<string, unknown> = {
      id: 7,
      uuid: 'transaction-7',
      name: 'Pro plan',
      description: 'Monthly plan',
      amount: 5900,
      type: 'subscription',
      provider_id: 'provider-7',
      payment_method_id: 3,
      user_id: 2,
    }

    expect(serializeBillingTransaction({ get: (key: string) => values[key] })).toEqual({
      id: 7,
      uuid: 'transaction-7',
      name: 'Pro plan',
      description: 'Monthly plan',
      amount: 5900,
      type: 'subscription',
      provider_id: 'provider-7',
      payment_method_id: 3,
    })
  })

  it('explains when the application User model is not billable', async () => {
    const result = await settleBillableRead({}, 'activeSubscription')
    expect(result.status).toBe('rejected')
    if (result.status === 'rejected')
      expect(result.reason.message).toContain('app/Models/User.ts')
  })
})
