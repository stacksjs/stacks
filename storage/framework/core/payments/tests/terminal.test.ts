import { describe, expect, it } from 'bun:test'
import {
  cardPresentDetails,
  isTestKey,
  latestChargeId,
  STRIPE_TERMINAL_API_VERSION,
  StripeApiError,
  stripeFormEncode,
  stripeTerminal,
  terminalChargeState,
} from '../src/terminal'

interface Seen { method: string, url: string, headers: Record<string, string>, body: string }

function recorder(answer: (seen: Seen) => Response) {
  const seen: Seen[] = []
  const fetch = (async (url: string, init: RequestInit = {}) => {
    const entry = { method: String(init.method), url, headers: init.headers as Record<string, string>, body: String(init.body ?? '') }
    seen.push(entry)
    return answer(entry)
  }) as unknown as typeof globalThis.fetch
  return { seen, fetch }
}

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

describe('Stripe’s form encoding', () => {
  it('nests objects and indexes arrays, and leaves out null', () => {
    expect(stripeFormEncode({ amount: 1500, allowed_payment_method_types: ['card_present'], metadata: { a: '1', b: null }, transfer_data: { destination: 'acct_1' }, empty: undefined, flag: true }))
      .toBe('amount=1500&allowed_payment_method_types%5B0%5D=card_present&metadata%5Ba%5D=1&transfer_data%5Bdestination%5D=acct_1&flag=true')
  })
})

describe('the Terminal client', () => {
  it('creates a card-present PaymentIntent with the pinned version, a bearer key and an idempotency key', async () => {
    const { seen, fetch } = recorder(() => ok({ id: 'pi_1', object: 'payment_intent', status: 'requires_payment_method' }))
    const terminal = stripeTerminal({ secretKey: 'sk_test_1', apiBase: 'https://stripe.test/', fetch })
    await terminal.createPaymentIntent({ amount: 2000, currency: 'EUR', metadata: { sale: '9' }, onBehalfOf: 'acct_9', transferDestination: 'acct_9' }, 'key-1')
    expect(seen[0]!.method).toBe('POST')
    expect(seen[0]!.url).toBe('https://stripe.test/v1/payment_intents')
    expect(seen[0]!.headers).toMatchObject({ 'Authorization': 'Bearer sk_test_1', 'Stripe-Version': STRIPE_TERMINAL_API_VERSION, 'Idempotency-Key': 'key-1', 'Content-Type': 'application/x-www-form-urlencoded' })
    const body = new URLSearchParams(seen[0]!.body)
    expect(body.get('amount')).toBe('2000')
    expect(body.get('currency')).toBe('eur')
    expect(body.get('allowed_payment_method_types[0]')).toBe('card_present')
    expect(body.get('capture_method')).toBe('automatic')
    expect(body.get('on_behalf_of')).toBe('acct_9')
    expect(body.get('transfer_data[destination]')).toBe('acct_9')
    expect(body.get('metadata[sale]')).toBe('9')
    expect(body.has('application_fee_amount')).toBe(false)
  })

  it('takes the platform’s fee on a destination charge, and gives it back with a refund', async () => {
    const { seen, fetch } = recorder(() => ok({ id: 'pi_2' }))
    const terminal = stripeTerminal({ secretKey: 'sk_test_1', apiBase: 'https://stripe.test', fetch })
    await terminal.createPaymentIntent({ amount: 2000, currency: 'eur', transferDestination: 'acct_9', applicationFeeAmount: 60 }, 'key-2')
    await terminal.createPaymentIntent({ amount: 2000, currency: 'eur', transferDestination: 'acct_9', applicationFeeAmount: 0 }, 'key-3')
    await terminal.refund({ paymentIntent: 'pi_2', reverseTransfer: true, refundApplicationFee: true }, 'refund-2')
    expect(new URLSearchParams(seen[0]!.body).get('application_fee_amount')).toBe('60')
    expect(new URLSearchParams(seen[1]!.body).has('application_fee_amount')).toBe(false)
    expect(seen[2]!.body).toBe('payment_intent=pi_2&reverse_transfer=true&refund_application_fee=true')
  })

  it('sends a GET’s parameters in the query and acts on a connected account when asked', async () => {
    const { seen, fetch } = recorder(() => ok({ object: 'list', data: [{ id: 'tmr_1' }] }))
    const terminal = stripeTerminal({ secretKey: 'sk_test_1', apiBase: 'https://stripe.test', stripeAccount: 'acct_2', apiVersion: null, fetch })
    expect(await terminal.listReaders({ location: 'tml_1' })).toEqual([{ id: 'tmr_1' }] as any)
    expect(seen[0]!.url).toBe('https://stripe.test/v1/terminal/readers?location=tml_1&limit=100')
    expect(seen[0]!.headers['Stripe-Account']).toBe('acct_2')
    expect(seen[0]!.headers['Stripe-Version']).toBeUndefined()
  })

  it('hands a PaymentIntent to a reader, cancels it, and refunds to the card', async () => {
    const { seen, fetch } = recorder(() => ok({ id: 'x' }))
    const terminal = stripeTerminal({ secretKey: 'sk_test_1', apiBase: 'https://stripe.test', fetch })
    await terminal.processPaymentIntent('tmr_1', 'pi_1', 'process-1')
    await terminal.cancelReaderAction('tmr_1')
    await terminal.presentPaymentMethod('tmr_1', { number: '4000000000000002' })
    await terminal.refund({ paymentIntent: 'pi_1', amount: 500, reverseTransfer: true }, 'refund-1')
    expect(seen.map(entry => `${entry.method} ${entry.url.replace('https://stripe.test', '')} ${entry.body}`)).toEqual([
      'POST /v1/terminal/readers/tmr_1/process_payment_intent payment_intent=pi_1',
      'POST /v1/terminal/readers/tmr_1/cancel_action ',
      'POST /v1/test_helpers/terminal/readers/tmr_1/present_payment_method card_present%5Bnumber%5D=4000000000000002',
      'POST /v1/refunds payment_intent=pi_1&amount=500&reverse_transfer=true',
    ])
  })

  it('throws Stripe’s error as StripeApiError, and a network failure as a connection error', async () => {
    const { fetch } = recorder(() => new Response(JSON.stringify({ error: { type: 'invalid_request_error', code: 'terminal_reader_busy', message: 'Reader is busy', param: 'reader' } }), { status: 400 }))
    const error = await stripeTerminal({ secretKey: 'sk_test_1', fetch }).processPaymentIntent('tmr_1', 'pi_1').catch(failure => failure)
    expect(error).toBeInstanceOf(StripeApiError)
    expect(error).toMatchObject({ status: 400, type: 'invalid_request_error', code: 'terminal_reader_busy', message: 'Reader is busy', definitive: true })
    const down = await stripeTerminal({ secretKey: 'sk_test_1', fetch: (async () => { throw new TypeError('offline') }) as any }).retrieveReader('tmr_1').catch(failure => failure)
    expect(down).toMatchObject({ status: 0, type: 'api_connection_error', definitive: false })
  })
})

describe('where a charge on a reader stands', () => {
  const reader = (status: 'in_progress' | 'succeeded' | 'failed', extra: Record<string, unknown> = {}) => ({
    action: { type: 'process_payment_intent', status, failure_code: null, failure_message: null, process_payment_intent: { payment_intent: 'pi_1' }, ...extra },
  })

  it('waits while the reader collects the card', () => {
    expect(terminalChargeState({ id: 'pi_1', status: 'requires_payment_method' }, reader('in_progress')).state).toBe('waiting')
    expect(terminalChargeState({ id: 'pi_1', status: 'processing' }, reader('succeeded')).state).toBe('waiting')
  })

  it('succeeds when the PaymentIntent did, and is cancelled when it was', () => {
    expect(terminalChargeState({ id: 'pi_1', status: 'succeeded' }, reader('in_progress')).state).toBe('succeeded')
    expect(terminalChargeState({ id: 'pi_1', status: 'canceled' }, null).state).toBe('canceled')
  })

  it('fails with the reader’s or the card’s reason', () => {
    expect(terminalChargeState({ id: 'pi_1', status: 'requires_payment_method' }, reader('failed', { failure_code: 'card_declined', failure_message: 'Your card was declined.' })))
      .toEqual({ state: 'failed', failureCode: 'card_declined', failureMessage: 'Your card was declined.' })
    expect(terminalChargeState({ id: 'pi_1', status: 'requires_payment_method', last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds', message: 'Insufficient funds.' } }, null))
      .toEqual({ state: 'failed', failureCode: 'insufficient_funds', failureMessage: 'Insufficient funds.' })
  })

  it('ignores a reader busy with another charge', () => {
    expect(terminalChargeState({ id: 'pi_2', status: 'requires_payment_method' }, reader('failed')).state).toBe('waiting')
  })
})

describe('the card on a receipt', () => {
  it('reads brand, last four, AID and authorisation from a card-present charge', () => {
    const intent = {
      object: 'payment_intent',
      latest_charge: {
        id: 'ch_1',
        authorization_code: '123456',
        payment_method_details: { type: 'card_present', card_present: { brand: 'visa', last4: '4242', funding: 'credit', read_method: 'contactless_emv', receipt: { application_preferred_name: 'Visa Credit', dedicated_file_name: 'A0000000031010', authorization_response_code: '3030', account_type: 'credit', cardholder_verification_method: 'approval' } } },
      },
    }
    expect(cardPresentDetails(intent)).toEqual({ brand: 'visa', last4: '4242', funding: 'credit', readMethod: 'contactless_emv', applicationName: 'Visa Credit', applicationId: 'A0000000031010', authorizationCode: '123456', authorizationResponseCode: '3030', accountType: 'credit', cardholderVerification: 'approval' })
    expect(latestChargeId(intent)).toBe('ch_1')
    expect(latestChargeId({ latest_charge: 'ch_2' })).toBe('ch_2')
    expect(cardPresentDetails({ object: 'charge', payment_method_details: { type: 'card' } })).toBeNull()
  })

  it('tells a test key from a live one', () => {
    expect(isTestKey('sk_test_abc')).toBe(true)
    expect(isTestKey('rk_test_abc')).toBe(true)
    expect(isTestKey('sk_live_abc')).toBe(false)
    expect(isTestKey(undefined)).toBe(false)
  })
})
