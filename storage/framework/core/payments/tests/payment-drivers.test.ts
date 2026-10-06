import type Stripe from 'stripe'
import type { Payer, StripeOperations } from '../src/driver'
import { describe, expect, it } from 'bun:test'
import {
  AdyenDriver,
  adyenConfig,
  adyenSignature,
  adyenSigningPayload,
  adyenStatus,
  PaymentProviderError,
  PaymentUnsupportedError,
  refundedThisTime,
  registerPaymentDriver,
  StripeDriver,
  stripePaymentStatus,
  WebhookNotConfiguredError,
  WebhookSignatureError,
} from '../src/driver'

/**
 * The provider-neutral payment drivers (stacksjs/stacks#665, #450).
 *
 * Adyen is exercised against a recording fetch, so every request is asserted
 * as it would leave the process; its webhook signing against the worked
 * example in Adyen's own documentation. Stripe through injected operations,
 * so the mapping is tested without the SDK.
 */

const payer: Payer = { id: 42, email: 'ada@example.com', name: 'Ada' }

interface Sent { url: URL, method: string, headers: Record<string, string>, body: any }

function adyen(...responses: Array<{ status?: number, body?: unknown }>) {
  const sent: Sent[] = []
  const driver = new AdyenDriver(
    { apiKey: 'test-api-key', merchantAccount: 'StacksECOM', environment: 'test', hmacKey: '44782DEF547AAA06C910C43932B1EB0C71FC68D9D0C057550C48EC2ACF6BA056' },
    {
      fetch: (async (input: URL, init: RequestInit) => {
        sent.push({ url: new URL(String(input)), method: String(init.method), headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(String(init.body)) : undefined })
        const next = responses[Math.min(sent.length - 1, responses.length - 1)] ?? {}
        const status = next.status ?? 200
        return new Response(status === 204 ? null : JSON.stringify(next.body ?? {}), { status })
      }) as unknown as typeof fetch,
    },
  )
  return { driver, sent }
}

function signedNotification(item: Record<string, any>, hmacKey = '44782DEF547AAA06C910C43932B1EB0C71FC68D9D0C057550C48EC2ACF6BA056'): string {
  const signed = { ...item, additionalData: { hmacSignature: adyenSignature(item, hmacKey) } }
  return JSON.stringify({ live: 'false', notificationItems: [{ NotificationRequestItem: signed }] })
}

describe('Adyen webhook signing', () => {
  it('matches the worked example in Adyen\'s documentation', () => {
    const item = {
      pspReference: '7914073381342284',
      merchantAccountCode: 'TestMerchant',
      merchantReference: 'TestPayment-1407325143704',
      amount: { value: 1130, currency: 'EUR' },
      eventCode: 'AUTHORISATION',
      success: 'true',
    }
    expect(adyenSigningPayload(item)).toBe('7914073381342284::TestMerchant:TestPayment-1407325143704:1130:EUR:AUTHORISATION:true')
    expect(adyenSignature(item, '44782DEF547AAA06C910C43932B1EB0C71FC68D9D0C057550C48EC2ACF6BA056')).toBe('coqCmt/IZ4E3CzPvMY8zTjQVL5hYJUiBRg8UU+iCWo0=')
  })

  it('verifies and translates a delivery, success and failure alike', async () => {
    const { driver } = adyen()
    const base = { pspReference: 'PSP1', merchantAccountCode: 'StacksECOM', merchantReference: 'order-7', amount: { value: 2500, currency: 'EUR' } }

    const [paid] = await driver.verifyWebhook({ payload: signedNotification({ ...base, eventCode: 'AUTHORISATION', success: 'true' }), headers: {} })
    expect(paid).toMatchObject({ provider: 'adyen', id: 'AUTHORISATION:PSP1:true', type: 'payment.succeeded', reference: 'PSP1', merchantReference: 'order-7', amount: { amount: 2500, currency: 'eur' } })

    const [declined] = await driver.verifyWebhook({ payload: signedNotification({ ...base, eventCode: 'AUTHORISATION', success: 'false' }), headers: {} })
    expect(declined!.type).toBe('payment.failed')
    // Adyen can resend a code and reference with the outcome changed. That is
    // news, not a retry, so it must not deduplicate against the first.
    expect(declined!.id).not.toBe(paid!.id)

    // A refund is about the payment it refunds, so it finds the same order.
    const [refunded] = await driver.verifyWebhook({ payload: signedNotification({ ...base, originalReference: 'PSP0', eventCode: 'REFUND', success: 'true' }), headers: {} })
    expect(refunded).toMatchObject({ type: 'refund.succeeded', reference: 'PSP0' })

    const [refused] = await driver.verifyWebhook({ payload: signedNotification({ ...base, eventCode: 'AUTHORISATION', success: 'false', reason: 'Not enough balance' }), headers: {} })
    expect(refused!.reason).toBe('Not enough balance')
  })

  it('says it is not configured, rather than that a delivery is forged, without its HMAC key', async () => {
    const driver = new AdyenDriver({ apiKey: 'k', merchantAccount: 'm', environment: 'test' })
    await expect(driver.verifyWebhook({ payload: '{}', headers: {} })).rejects.toBeInstanceOf(WebhookNotConfiguredError)
  })

  it('refuses a delivery signed with another key, or not signed at all', async () => {
    const { driver } = adyen()
    const item = { pspReference: 'PSP1', merchantAccountCode: 'StacksECOM', eventCode: 'AUTHORISATION', success: 'true', amount: { value: 1, currency: 'EUR' } }
    await expect(driver.verifyWebhook({ payload: signedNotification(item, 'AB'.repeat(32)), headers: {} })).rejects.toThrow(WebhookSignatureError)
    const unsigned = JSON.stringify({ notificationItems: [{ NotificationRequestItem: item }] })
    await expect(driver.verifyWebhook({ payload: unsigned, headers: {} })).rejects.toThrow('has no hmacSignature')
  })

  it('cannot verify anything without the HMAC key', async () => {
    const driver = new AdyenDriver({ apiKey: 'k', merchantAccount: 'm', environment: 'test' }, { fetch: (() => {}) as never })
    await expect(driver.verifyWebhook({ payload: '{}', headers: {} })).rejects.toThrow('without the HMAC key')
  })

  it('acknowledges with a 2xx, as Adyen requires within 10 seconds', () => {
    expect(adyen().driver.acknowledgeWebhook().status).toBe(202)
  })
})

describe('Adyen payments', () => {
  it('charges a stored card as a merchant-initiated payment', async () => {
    const { driver, sent } = adyen({ body: { pspReference: 'PSP9', resultCode: 'Authorised' } })
    const result = await driver.charge(payer, { amount: 1999, currency: 'eur' }, 'stored-card-1', { reference: 'order-1', idempotencyKey: 'idem-1' })

    expect(result).toMatchObject({ id: 'PSP9', status: 'succeeded', amount: { amount: 1999, currency: 'eur' } })
    expect(sent[0]!.url.toString()).toBe('https://checkout-test.adyen.com/v72/payments')
    expect(sent[0]!.headers).toMatchObject({ 'X-API-Key': 'test-api-key', 'Idempotency-Key': 'idem-1' })
    expect(sent[0]!.body).toEqual({
      merchantAccount: 'StacksECOM',
      amount: { value: 1999, currency: 'EUR' },
      reference: 'order-1',
      paymentMethod: { type: 'scheme', storedPaymentMethodId: 'stored-card-1' },
      shopperReference: 'user-42',
      shopperInteraction: 'ContAuth',
      recurringProcessingModel: 'UnscheduledCardOnFile',
    })
  })

  it('reports a refusal with its reason, and a redirect as an action', async () => {
    const refused = await adyen({ body: { pspReference: 'P', resultCode: 'Refused', refusalReason: 'Not enough balance' } }).driver.charge(payer, { amount: 5, currency: 'eur' }, 'c')
    expect(refused).toMatchObject({ status: 'failed', failureReason: 'Not enough balance' })
    const redirect = await adyen({ body: { pspReference: 'P', resultCode: 'RedirectShopper', action: { url: 'https://bank.example/3ds' } } }).driver.charge(payer, { amount: 5, currency: 'eur' }, 'c')
    expect(redirect).toMatchObject({ status: 'requires_action', redirectUrl: 'https://bank.example/3ds' })
  })

  it('maps every documented result code, and only the four final ones as final', () => {
    expect(['Authorised', 'Refused', 'Error', 'Cancelled'].map(adyenStatus)).toEqual(['succeeded', 'failed', 'failed', 'canceled'])
    expect(['RedirectShopper', 'ChallengeShopper', 'IdentifyShopper', 'PresentToShopper'].map(adyenStatus)).toEqual(Array(4).fill('requires_action'))
    expect(['Pending', 'Received', 'PartiallyAuthorised', 'AuthenticationFinished', 'AuthenticationNotRequired'].map(adyenStatus)).toEqual(Array(5).fill('processing'))
  })

  it('starts a Drop-in session the browser completes', async () => {
    const { driver, sent } = adyen({ body: { id: 'CS1', sessionData: 'Ab02b4c...' } })
    await expect(driver.createPayment(payer, { amount: 1000, currency: 'usd' })).rejects.toThrow('needs a returnUrl')
    const result = await driver.createPayment(payer, { amount: 1000, currency: 'usd' }, { returnUrl: 'https://app.test/return' })
    expect(result.clientConfirmation).toEqual({ provider: 'adyen', sessionId: 'CS1', sessionData: 'Ab02b4c...' })
    expect(sent[0]!.body).toMatchObject({ mode: 'embedded', returnUrl: 'https://app.test/return', amount: { value: 1000, currency: 'USD' } })
  })

  it('refunds part of a payment by amount, and all of it as a reversal', async () => {
    const partial = adyen({ body: { pspReference: 'R1', status: 'received' } })
    const refund = await partial.driver.refund('PSP9', { amount: { amount: 500, currency: 'eur' } })
    expect(partial.sent[0]!.url.pathname).toBe('/v72/payments/PSP9/refunds')
    expect(partial.sent[0]!.body).toMatchObject({ merchantAccount: 'StacksECOM', amount: { value: 500, currency: 'EUR' } })
    expect(refund).toMatchObject({ id: 'R1', paymentId: 'PSP9', status: 'pending' })

    const full = adyen({ body: { pspReference: 'R2', status: 'received' } })
    expect((await full.driver.refund('PSP9')).amount).toBeNull()
    expect(full.sent[0]!.url.pathname).toBe('/v72/payments/PSP9/reversals')
    expect(full.sent[0]!.body.amount).toBeUndefined()
  })

  it('opens a hosted checkout priced line by line', async () => {
    const { driver, sent } = adyen({ body: { id: 'CS2', url: 'https://checkout-test.adyen.com/checkoutshopper/pay/CS2', expiresAt: '2026-10-07T00:00:00Z' } })
    const session = await driver.checkout(payer, {
      mode: 'payment',
      currency: 'eur',
      lines: [{ name: 'Seat', unitAmount: 1200, quantity: 2 }, { name: 'Fee', unitAmount: 100, quantity: 1 }],
      successUrl: 'https://app.test/done',
      reference: 'order-9',
    })
    expect(session).toMatchObject({ id: 'CS2', url: 'https://checkout-test.adyen.com/checkoutshopper/pay/CS2' })
    expect(sent[0]!.body).toMatchObject({
      mode: 'hosted',
      amount: { value: 2500, currency: 'EUR' },
      returnUrl: 'https://app.test/done',
      reference: 'order-9',
      shopperEmail: 'ada@example.com',
      lineItems: [{ description: 'Seat', quantity: 2, amountIncludingTax: 1200 }, { description: 'Fee', quantity: 1, amountIncludingTax: 100 }],
    })
  })

  it('refuses what Adyen does not have, naming the driver and the operation', async () => {
    const { driver } = adyen()
    const base = { currency: 'eur', successUrl: 'https://app.test/done' }
    await expect(driver.checkout(payer, { ...base, mode: 'subscription', lines: [] })).rejects.toThrow(PaymentUnsupportedError)
    await expect(driver.checkout(payer, { ...base, mode: 'payment', lines: [{ price: 'price_1', quantity: 1 }] })).rejects.toThrow('does not support catalog prices')
    await expect(driver.checkout(payer, { ...base, mode: 'payment', lines: [], cancelUrl: 'https://app.test/cancel' })).rejects.toThrow('separate cancelUrl')
    await expect(driver.checkout(payer, { ...base, mode: 'payment', lines: [], allowPromotionCodes: true })).rejects.toThrow('promotion codes')
    await expect(driver.checkout(payer, { ...base, mode: 'payment', lines: [], automaticTax: true })).rejects.toThrow('automatic tax')
    await expect(driver.checkout(payer, { ...base, mode: 'payment', lines: [], trialDays: 14 })).rejects.toThrow('subscription checkout')
    const error = await driver.subscribe().catch(e => e)
    expect(error).toBeInstanceOf(PaymentUnsupportedError)
    expect(error).toMatchObject({ driver: 'adyen', operation: 'subscriptions' })
    expect(driver.capabilities.has('subscriptions')).toBe(false)
  })

  it('refuses a return URL off the application\'s origin, as Stripe\'s checkout does', async () => {
    const sent: unknown[] = []
    const driver = new AdyenDriver(
      { apiKey: 'k', merchantAccount: 'm', environment: 'test', appUrl: 'https://app.test' },
      { fetch: (async () => { sent.push(1); return Response.json({ id: 'x', url: 'https://checkout-test.adyen.com/x', sessionData: 's' }) }) as never },
    )
    await expect(driver.checkout(payer, { mode: 'payment', currency: 'eur', lines: [], successUrl: 'https://evil.example/done' })).rejects.toThrow('not on the application\'s origin')
    await expect(driver.createPayment(payer, { amount: 1, currency: 'eur' }, { returnUrl: 'https://evil.example/r' })).rejects.toThrow('not on the application\'s origin')
    expect(sent).toHaveLength(0)
    await driver.checkout(payer, { mode: 'payment', currency: 'eur', lines: [], successUrl: 'https://app.test/done' })
    expect(sent).toHaveLength(1)
  })

  it('lists and removes stored cards by shopper reference', async () => {
    const { driver, sent } = adyen(
      { body: { storedPaymentMethods: [{ id: 'S1', type: 'scheme', brand: 'visa', lastFour: '1111', expiryMonth: '03', expiryYear: '30' }] } },
      { status: 204 },
    )
    expect(await driver.paymentMethods(payer)).toEqual([
      { id: 'S1', type: 'scheme', brand: 'visa', last4: '1111', expMonth: 3, expYear: 2030, isDefault: false, raw: expect.any(Object) },
    ])
    expect(Object.fromEntries(sent[0]!.url.searchParams)).toEqual({ merchantAccount: 'StacksECOM', shopperReference: 'user-42' })

    await driver.removePaymentMethod(payer, 'S1')
    expect(sent[1]).toMatchObject({ method: 'DELETE' })
    expect(sent[1]!.url.pathname).toBe('/v72/storedPaymentMethods/S1')
  })

  it('surfaces a rejection with Adyen\'s status and error code', async () => {
    const { driver } = adyen({ status: 422, body: { status: 422, errorCode: '14_030', message: 'Return URL is missing.', errorType: 'validation' } })
    const error = await driver.charge(payer, { amount: 1, currency: 'eur' }, 'c').catch(e => e)
    expect(error).toBeInstanceOf(PaymentProviderError)
    expect(error).toMatchObject({ driver: 'adyen', status: 422, code: '14_030' })
  })

  it('refuses amounts that are not minor units before sending anything', async () => {
    const { driver, sent } = adyen()
    await expect(driver.charge(payer, { amount: 19.99, currency: 'eur' }, 'c')).rejects.toThrow('whole number of minor units')
    expect(sent).toHaveLength(0)
  })

  it('needs its credentials, and its own endpoint to go live', () => {
    expect(() => new AdyenDriver({ apiKey: '', merchantAccount: 'm', environment: 'test' })).toThrow('ADYEN_API_KEY')
    expect(() => new AdyenDriver({ apiKey: 'k', merchantAccount: 'm', environment: 'live' })).toThrow('ADYEN_LIVE_URL_PREFIX')
    expect(new AdyenDriver({ apiKey: 'k', merchantAccount: 'm', environment: 'live', liveUrlPrefix: '1797a841fbb37ca7-AdyenDemo' }).baseUrl)
      .toBe('https://1797a841fbb37ca7-AdyenDemo-checkout-live.adyenpayments.com/checkout/v72')
  })

  it('reads its settings from config, then the ADYEN_* environment', () => {
    expect(adyenConfig({}, { ADYEN_API_KEY: 'k', ADYEN_MERCHANT_ACCOUNT: 'm', ADYEN_ENVIRONMENT: 'live', ADYEN_LIVE_URL_PREFIX: 'p', ADYEN_HMAC_KEY: 'h' }))
      .toEqual({ apiKey: 'k', merchantAccount: 'm', environment: 'live', liveUrlPrefix: 'p', hmacKey: 'h', shopperReferencePrefix: undefined })
    expect(adyenConfig({ apiKey: 'from-config' }, { ADYEN_API_KEY: 'from-env' }).apiKey).toBe('from-config')
  })
})

function stripeDriver(overrides: Partial<StripeOperations> = {}, webhookSecret: string | undefined = 'whsec_test') {
  const calls: Array<[string, unknown[]]> = []
  const record = <T>(name: string, value: T) => (...args: unknown[]) => {
    calls.push([name, args])
    return Promise.resolve(value)
  }
  const operations: StripeOperations = {
    customer: record('customer', { id: 'cus_1', email: 'ada@example.com', name: 'Ada', invoice_settings: { default_payment_method: 'pm_2' } } as unknown as Stripe.Customer),
    createIntent: record('createIntent', { id: 'pi_1', status: 'succeeded', amount: 1999, currency: 'eur', client_secret: 'pi_1_secret' } as Stripe.PaymentIntent),
    refund: record('refund', { id: 're_1', status: 'succeeded', amount: 500, currency: 'eur' } as Stripe.Refund),
    createCheckout: record('createCheckout', { id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1', expires_at: 1_800_000_000 } as Stripe.Checkout.Session),
    listPaymentMethods: record('listPaymentMethods', [
      { id: 'pm_1', type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 1, exp_year: 2031 } },
      { id: 'pm_2', type: 'card', card: { brand: 'amex', last4: '0005', exp_month: 2, exp_year: 2032 } },
    ] as Stripe.PaymentMethod[]),
    deletePaymentMethod: record('deletePaymentMethod', undefined),
    subscribe: record('subscribe', { id: 'sub_1', status: 'incomplete', cancel_at_period_end: false, latest_invoice: { confirmation_secret: { client_secret: 'pi_9_secret', type: 'payment_intent' } }, items: { data: [{ price: { id: 'price_pro', nickname: null, lookup_key: 'pro_monthly', unit_amount: 1900, currency: 'usd', recurring: { interval: 'month' } }, current_period_end: 1_800_000_000 }] } } as unknown as Stripe.Subscription),
    cancelSubscription: record('cancelSubscription', { id: 'sub_1', status: 'incomplete_expired', cancel_at_period_end: false, items: { data: [] } } as unknown as Stripe.Subscription),
    listSubscriptions: record('listSubscriptions', [{ id: 'sub_2', status: 'something_new', cancel_at_period_end: true, items: { data: [] } }] as unknown as Stripe.Subscription[]),
    constructEvent: record('constructEvent', { id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1', amount: 1999, currency: 'eur', metadata: { reference: 'order-1' } } } } as unknown as Stripe.Event),
    ...overrides,
  }
  return { driver: new StripeDriver({ operations, webhookSecret }), calls }
}

describe('the Stripe driver', () => {
  it('charges a stored card off session, as the payer\'s customer', async () => {
    const { driver, calls } = stripeDriver()
    const result = await driver.charge(payer, { amount: 1999, currency: 'EUR' }, 'pm_1', { reference: 'order-1', idempotencyKey: 'k1' })
    expect(result).toMatchObject({ id: 'pi_1', status: 'succeeded', amount: { amount: 1999, currency: 'eur' } })
    expect(result.clientConfirmation).toBeUndefined()
    const [, [, params, key]] = calls.find(([name]) => name === 'createIntent')!
    expect(params).toMatchObject({ amount: 1999, currency: 'eur', customer: 'cus_1', payment_method: 'pm_1', confirm: true, off_session: true, metadata: { reference: 'order-1' } })
    expect(key).toBe('k1')
  })

  it('maps PaymentIntent statuses, and hands the browser its client secret only when it must act', async () => {
    expect(stripePaymentStatus({ status: 'requires_capture', last_payment_error: null })).toBe('processing')
    expect(stripePaymentStatus({ status: 'requires_payment_method', last_payment_error: { message: 'declined' } as never })).toBe('failed')
    expect(stripePaymentStatus({ status: 'requires_payment_method', last_payment_error: null })).toBe('requires_payment_method')

    const { driver } = stripeDriver({
      createIntent: async () => ({ id: 'pi_2', status: 'requires_action', amount: 100, currency: 'usd', client_secret: 'pi_2_secret', next_action: { redirect_to_url: { url: 'https://hooks.stripe.com/3ds' } } }) as unknown as Stripe.PaymentIntent,
    })
    expect(await driver.createPayment(payer, { amount: 100, currency: 'usd' })).toMatchObject({
      status: 'requires_action',
      clientConfirmation: { provider: 'stripe', clientSecret: 'pi_2_secret' },
      redirectUrl: 'https://hooks.stripe.com/3ds',
    })
  })

  it('refunds by amount through the billable refund', async () => {
    const { driver, calls } = stripeDriver()
    expect(await driver.refund('pi_1', { amount: { amount: 500, currency: 'eur' }, reason: 'requested_by_customer' }))
      .toMatchObject({ id: 're_1', paymentId: 'pi_1', status: 'succeeded', amount: { amount: 500, currency: 'eur' } })
    expect(calls.find(([name]) => name === 'refund')![1]).toEqual(['pi_1', { amount: 500, reason: 'requested_by_customer' }])
  })

  it('opens a checkout from catalog prices and from lines priced here', async () => {
    const { driver, calls } = stripeDriver()
    const session = await driver.checkout(payer, {
      mode: 'payment',
      currency: 'EUR',
      lines: [{ price: 'price_pro', quantity: 1 }, { name: 'Setup', unitAmount: 900, quantity: 1 }],
      successUrl: 'https://app.test/done',
      cancelUrl: 'https://app.test/cancel',
      reference: 'order-3',
    })
    expect(session).toMatchObject({ id: 'cs_1', url: 'https://checkout.stripe.com/c/cs_1', expiresAt: new Date(1_800_000_000_000) })
    expect(calls.find(([name]) => name === 'createCheckout')![1][1]).toEqual({
      customer: 'cus_1',
      mode: 'payment',
      success_url: 'https://app.test/done',
      cancel_url: 'https://app.test/cancel',
      line_items: [
        { price: 'price_pro', quantity: 1 },
        { quantity: 1, price_data: { currency: 'eur', unit_amount: 900, product_data: { name: 'Setup' } } },
      ],
      client_reference_id: 'order-3',
      // On the PaymentIntent too, which is what payment_intent.* webhooks read.
      payment_intent_data: { metadata: { reference: 'order-3' } },
    })
  })

  it('starts a subscription checkout with a trial, beside the carried metadata', async () => {
    const { driver, calls } = stripeDriver()
    await driver.checkout(payer, {
      mode: 'subscription',
      lines: [{ price: 'price_pro', quantity: 1 }],
      successUrl: 'https://app.test/welcome',
      metadata: { plan: 'pro' },
      trialDays: 14,
    })
    expect(calls.find(([name]) => name === 'createCheckout')![1][1]).toMatchObject({
      subscription_data: { metadata: { plan: 'pro' }, trial_period_days: 14 },
    })

    const plain = stripeDriver()
    await plain.driver.checkout(payer, { mode: 'subscription', lines: [{ price: 'price_pro', quantity: 1 }], successUrl: 'https://app.test/welcome', trialDays: 7 })
    expect(plain.calls.find(([name]) => name === 'createCheckout')![1][1]).toMatchObject({ subscription_data: { trial_period_days: 7 } })
  })

  it('refuses a trial on anything but a subscription, or one that is not whole days', async () => {
    const { driver } = stripeDriver()
    const base = { lines: [{ price: 'price_pro', quantity: 1 }], successUrl: 'https://app.test/welcome' }
    await expect(driver.checkout(payer, { ...base, mode: 'payment', trialDays: 14 })).rejects.toThrow('subscription checkout')
    await expect(driver.checkout(payer, { ...base, mode: 'subscription', trialDays: 1.5 })).rejects.toThrow('whole number')
    await expect(driver.checkout(payer, { ...base, mode: 'subscription', trialDays: 0 })).rejects.toThrow('whole number')
  })

  it('carries a subscription checkout\'s metadata onto the subscription, with promotion codes and tax', async () => {
    const { driver, calls } = stripeDriver()
    await driver.checkout(payer, {
      mode: 'subscription',
      lines: [{ price: 'price_pro', quantity: 1 }],
      successUrl: 'https://app.test/welcome',
      cancelUrl: 'https://app.test/pricing',
      metadata: { user_id: '7' },
      allowPromotionCodes: true,
      automaticTax: true,
    })
    expect(calls.find(([name]) => name === 'createCheckout')![1][1]).toEqual({
      customer: 'cus_1',
      mode: 'subscription',
      success_url: 'https://app.test/welcome',
      cancel_url: 'https://app.test/pricing',
      line_items: [{ price: 'price_pro', quantity: 1 }],
      metadata: { user_id: '7' },
      // A session's metadata never reaches the subscription it creates; the
      // customer.subscription.* webhooks read the subscription's own.
      subscription_data: { metadata: { user_id: '7' } },
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
    })
  })

  it('lists cards with the customer\'s default marked', async () => {
    const methods = await stripeDriver().driver.paymentMethods(payer)
    expect(methods.map(method => [method.id, method.brand, method.last4, method.isDefault])).toEqual([['pm_1', 'visa', '4242', false], ['pm_2', 'amex', '0005', true]])
  })

  it('summarises subscriptions, period from the item, unknown statuses as unknown', async () => {
    const { driver } = stripeDriver()
    expect(await driver.subscribe(payer, 'pro_monthly')).toMatchObject({
      id: 'sub_1',
      status: 'incomplete',
      price: { id: 'price_pro', name: 'pro_monthly', amount: { amount: 1900, currency: 'usd' }, interval: 'month' },
      currentPeriodEnd: new Date(1_800_000_000_000),
      // The first payment waits on the payer; the browser confirms it.
      clientConfirmation: { provider: 'stripe', clientSecret: 'pi_9_secret' },
    })
    expect((await driver.cancelSubscription('sub_1')).status).toBe('canceled')
    expect((await driver.subscriptions(payer))[0]).toMatchObject({ status: 'unknown', cancelAtPeriodEnd: true })
  })

  it('verifies a webhook and names the event in our terms', async () => {
    const { driver, calls } = stripeDriver()
    const [event] = await driver.verifyWebhook({ payload: '{"id":"evt_1"}', headers: new Headers({ 'Stripe-Signature': 't=1,v1=abc' }) })
    expect(event).toMatchObject({ provider: 'stripe', id: 'evt_1', type: 'payment.succeeded', providerType: 'payment_intent.succeeded', reference: 'pi_1', merchantReference: 'order-1', amount: { amount: 1999, currency: 'eur' } })
    expect(calls.find(([name]) => name === 'constructEvent')![1]).toEqual(['{"id":"evt_1"}', 't=1,v1=abc', 'whsec_test'])
  })

  it('names a refund by the payment it refunds, with the amount refunded', async () => {
    const { driver } = stripeDriver({
      constructEvent: async () => ({ id: 'evt_2', type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_1', amount: 1999, amount_refunded: 500, currency: 'eur' }, previous_attributes: { amount_refunded: 0 } } }) as unknown as Stripe.Event,
    })
    const [event] = await driver.verifyWebhook({ payload: '{}', headers: { 'stripe-signature': 'x' } })
    expect(event).toMatchObject({ type: 'refund.succeeded', reference: 'pi_1', amount: { amount: 500, currency: 'eur' } })
  })

  it('gives a second partial refund its own amount, not the charge\'s running total', async () => {
    // The charge says 1200 refunded in all; 500 of that was the first refund.
    const { driver } = stripeDriver({
      constructEvent: async () => ({ id: 'evt_3', type: 'charge.refunded', data: { object: { id: 'ch_1', payment_intent: 'pi_1', amount: 1999, amount_refunded: 1200, currency: 'eur' }, previous_attributes: { amount_refunded: 500 } } }) as unknown as Stripe.Event,
    })
    const [event] = await driver.verifyWebhook({ payload: '{}', headers: { 'stripe-signature': 'x' } })
    expect(event!.amount).toEqual({ amount: 700, currency: 'eur' })
  })

  it('reads a refund with no previous total as the first', () => {
    expect(refundedThisTime({ amount_refunded: 300 })).toBe(300)
    expect(refundedThisTime({ amount_refunded: 300 }, null)).toBe(300)
    expect(refundedThisTime({})).toBeUndefined()
  })

  it('refuses a webhook it cannot verify', async () => {
    await expect(stripeDriver().driver.verifyWebhook({ payload: '{}', headers: {} })).rejects.toThrow('no Stripe-Signature header')
    await expect(stripeDriver({}, '').driver.verifyWebhook({ payload: '{}', headers: { 'stripe-signature': 'x' } })).rejects.toThrow('STRIPE_WEBHOOK_SECRET')
    // Its own class: a route answers "not configured", not "forged".
    await expect(stripeDriver({}, '').driver.verifyWebhook({ payload: '{}', headers: { 'stripe-signature': 'x' } })).rejects.toBeInstanceOf(WebhookNotConfiguredError)
    const forged = stripeDriver({ constructEvent: async () => { throw new Error('No signatures found matching the expected signature') } })
    await expect(forged.driver.verifyWebhook({ payload: '{}', headers: { 'stripe-signature': 'x' } })).rejects.toThrow(WebhookSignatureError)
  })
})

describe('registerPaymentDriver', () => {
  it('will not let a built-in name be replaced', () => {
    expect(() => registerPaymentDriver('stripe', () => stripeDriver().driver)).toThrow('built-in')
  })
})
