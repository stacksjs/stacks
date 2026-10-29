import { describe, expect, test } from 'bun:test'
import { connectedAccountDefaults, MANAGED_RISK_CONTROLLER } from '../src/connect/account'
import {
  asAccount,
  connectedCustomer,
  connectedCustomerIdempotencyKey,
  directCheckout,
  directCheckoutPaymentData,
  directCheckoutSubscriptionData,
  directPaymentIntentParams,
  directSubscriptionParams,
  manageDirectSubscription,
} from '../src/connect/direct'
import { connectRefund, connectRefundParams } from '../src/connect/refund'

const account = 'acct_gym'

describe('direct charges carry only the platform fee', () => {
  test('a one-off charge: an application fee amount, no transfer', () => {
    expect(directPaymentIntentParams(4900, { feePercent: 10 })).toEqual({ application_fee_amount: 490 })
    expect(directPaymentIntentParams(4900, { feeCents: 140 })).toEqual({ application_fee_amount: 140 })
    expect(directPaymentIntentParams(4900)).toEqual({})
  })

  test('Checkout payment data keeps the other fields and drops destination ones', () => {
    const data = directCheckoutPaymentData(11940, { feeCents: 140 }, {
      metadata: { order_id: '31' },
      description: 'INV-0031',
      transfer_data: { destination: 'acct_old' },
      on_behalf_of: 'acct_old',
      application_fee_amount: 9999,
    })
    expect(data).toEqual({ metadata: { order_id: '31' }, description: 'INV-0031', application_fee_amount: 140 })
  })

  test('a subscription takes a percent of every invoice', () => {
    expect(directSubscriptionParams({ feePercent: 2.5 })).toEqual({ application_fee_percent: 2.5 })
    expect(directSubscriptionParams({})).toEqual({})
    expect(directCheckoutSubscriptionData({ feePercent: 3 }, { trial_period_days: 14, transfer_data: { destination: 'acct_old' } }))
      .toEqual({ trial_period_days: 14, application_fee_percent: 3 })
    expect(() => directSubscriptionParams({ feeCents: 100 })).toThrow(/feePercent/)
  })

  test('calls act as the account', () => {
    expect(asAccount(account)).toEqual({ stripeAccount: account })
    expect(asAccount(account, { idempotencyKey: 'k' })).toEqual({ idempotencyKey: 'k', stripeAccount: account })
    expect(() => asAccount('')).toThrow(/connected account/)
  })
})

describe('the user\'s customer on a connected account', () => {
  function fakeClient(existing: any[] = [], searched: any[] = []) {
    const calls: Array<{ op: string, params: any, options: any }> = []
    return {
      calls,
      client: {
        customers: {
          list: async (params: any, options: any) => { calls.push({ op: 'list', params, options }); return { data: existing } },
          search: async (params: any, options: any) => { calls.push({ op: 'search', params, options }); return { data: searched } },
          create: async (params: any, options: any) => { calls.push({ op: 'create', params, options }); return { id: 'cus_new', ...params } },
        },
      } as any,
    }
  }
  const user = { id: 7, email: 'ava@example.com', name: 'Ava Stone' }

  test('is found by email when it carries the user\'s id', async () => {
    const { client, calls } = fakeClient([{ id: 'cus_other', metadata: {} }, { id: 'cus_ava', metadata: { stacks_user_id: '7' } }])
    expect((await connectedCustomer(user, account, client)).id).toBe('cus_ava')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.options).toEqual({ stripeAccount: account })
  })

  test('is found by metadata when the email changed', async () => {
    const { client, calls } = fakeClient([], [{ id: 'cus_ava', metadata: { stacks_user_id: '7' } }])
    expect((await connectedCustomer(user, account, client)).id).toBe('cus_ava')
    expect(calls.map(call => call.op)).toEqual(['list', 'search'])
    expect(calls[1]!.params.query).toBe('metadata[\'stacks_user_id\']:\'7\'')
  })

  test('is created on the account with a stable idempotency key otherwise', async () => {
    const { client, calls } = fakeClient()
    const customer = await connectedCustomer(user, account, client)
    expect(customer.id).toBe('cus_new')
    const create = calls.find(call => call.op === 'create')!
    expect(create.params).toEqual({ email: 'ava@example.com', name: 'Ava Stone', metadata: { stacks_user_id: '7' } })
    expect(create.options.stripeAccount).toBe(account)
    expect(create.options.idempotencyKey).toBe(connectedCustomerIdempotencyKey(account, 7, create.params))
    expect(connectedCustomerIdempotencyKey('acct_other', 7, create.params)).not.toBe(create.options.idempotencyKey)
  })
})

describe('a direct subscription checkout', () => {
  test('is made on the account with the fee percent and the user\'s customer there', async () => {
    const calls: any[] = []
    const client = {
      customers: {
        list: async () => ({ data: [{ id: 'cus_ava', metadata: { stacks_user_id: '7' } }] }),
        search: async () => ({ data: [] }),
        create: async () => { throw new Error('not expected') },
      },
      checkout: { sessions: { create: async (params: any, options: any) => { calls.push({ params, options }); return { id: 'cs_1', url: 'https://checkout.stripe.com/x' } } } },
    } as any
    await manageDirectSubscription.checkout({ id: 7, email: 'ava@example.com' } as any, {
      account,
      price: { amount: 4900, currency: 'EUR', interval: 'month', productName: 'Unlimited' },
      platformFeePercent: 5,
      trialDays: 14,
      successUrl: 'https://stacks.localhost/ok',
      cancelUrl: 'https://stacks.localhost/no',
    }, client)
    expect(calls[0].options.stripeAccount).toBe(account)
    expect(calls[0].options.idempotencyKey).toBeString()
    expect(calls[0].params.customer).toBe('cus_ava')
    expect(calls[0].params.mode).toBe('subscription')
    expect(calls[0].params.subscription_data).toEqual({ application_fee_percent: 5, trial_period_days: 14 })
    expect(calls[0].params.line_items[0].price_data.currency).toBe('eur')
  })
})

describe('a direct checkout', () => {
  const client = {
    customers: { list: async () => ({ data: [] }), search: async () => ({ data: [] }), create: async () => ({ id: 'cus_new' }) },
    checkout: { sessions: { create: async (params: any, options: any) => ({ id: 'cs_1', params, options }) } },
  } as any

  test('is a payment on the account for the user\'s customer there', async () => {
    const session: any = await directCheckout({ id: 7, email: 'a@b.c' }, account, { line_items: [], success_url: 'https://stacks.localhost/ok', cancel_url: 'https://stacks.localhost/no' }, client)
    expect(session.params.mode).toBe('payment')
    expect(session.params.customer).toBe('cus_new')
    expect(session.options.stripeAccount).toBe(account)
  })

  test('keeps a customer the caller named, and refuses a foreign return URL', async () => {
    const session: any = await directCheckout({ id: 7 }, account, { customer: 'cus_named', success_url: 'https://stacks.localhost/ok', cancel_url: 'https://stacks.localhost/no' }, client)
    expect(session.params.customer).toBe('cus_named')
    await expect(directCheckout({ id: 7 }, account, { success_url: 'https://evil.example/ok', cancel_url: 'https://stacks.localhost/no' }, client)).rejects.toThrow(/origin/)
  })
  test('reuses a caller-owned logical checkout attempt without changing its parameters', async () => {
    const options = { account, customer: 'cus_named', price: { amount: 1999, currency: 'EUR', interval: 'month' as const, productName: 'Running' }, successUrl: 'https://stacks.localhost/ok', cancelUrl: 'https://stacks.localhost/no', idempotencyKey: 'coaching-attempt-1' }
    const first: any = await manageDirectSubscription.checkout({ id: 7 } as any, options, client)
    const second: any = await manageDirectSubscription.checkout({ id: 7 } as any, options, client)
    expect(first.options.idempotencyKey).toBe('coaching-attempt-1')
    expect(second.options).toEqual(first.options)
    expect(second.params).toEqual(first.params)
  })

})

describe('refunding a direct charge', () => {
  test('gives the application fee back and reverses no transfer', () => {
    expect(connectRefundParams({ id: 'pi_1', application_fee_amount: 140 }, { account })).toEqual({ payment_intent: 'pi_1', refund_application_fee: true })
    expect(connectRefundParams({ id: 'pi_1', application_fee_amount: 140 }, { account, refundApplicationFee: false })).toEqual({ payment_intent: 'pi_1' })
    expect(connectRefundParams({ id: 'pi_1' }, { account })).toEqual({ payment_intent: 'pi_1' })
  })

  test('is read and made as the account', async () => {
    const calls: string[] = []
    const client = {
      paymentIntents: { retrieve: async (id: string, params: any, options: any) => { calls.push(`retrieve ${id} ${options?.stripeAccount}`); return { id, application_fee_amount: 140 } } },
      charges: { retrieve: async () => { throw new Error('not expected') } },
      refunds: { create: async (params: any, options: any) => { calls.push(`refund ${JSON.stringify(params)} ${options.stripeAccount} ${options.idempotencyKey}`); return { id: 're_1' } } },
    } as any
    await connectRefund('pi_1', { account, amount: 500, idempotencyKey: 'key-1', client })
    expect(calls[0]).toBe(`retrieve pi_1 ${account}`)
    expect(calls[1]).toBe(`refund {"payment_intent":"pi_1","amount":500,"refund_application_fee":true} ${account} key-1`)
  })
})

describe('new connected accounts', () => {
  test('are Managed Risk unless the caller chose otherwise', () => {
    expect(connectedAccountDefaults({})).toEqual({ controller: MANAGED_RISK_CONTROLLER })
    expect(MANAGED_RISK_CONTROLLER.losses?.payments).toBe('stripe')
    expect(connectedAccountDefaults({ type: 'express' })).toEqual({})
    expect(connectedAccountDefaults({ controller: { losses: { payments: 'application' } } })).toEqual({})
  })
})
