import { describe, expect, it } from 'bun:test'
import {
  currencyForCountry,
  debitDetailsOf,
  debitEventOf,
  debitFailureNextStep,
  isDebitNoticeDue,
  isDebitNoticeTimely,
  isDelayedPaymentMethod,
  mandateReferenceOf,
  parsePaymentMethods,
  paymentMethodsFor,
  regionOfLocale,
  retrieveDebitMandate,
} from '../src/direct-debit'

const sepaCharge = (overrides: Record<string, unknown> = {}) => ({
  id: 'ch_1',
  object: 'charge',
  amount: 4900,
  currency: 'eur',
  payment_intent: 'pi_1',
  metadata: { membership_id: '12' },
  payment_method_details: {
    type: 'sepa_debit',
    sepa_debit: { mandate: 'mandate_1', last4: '3000', bank_code: '37040044', country: 'DE', expected_debit_date: '2026-10-20' },
  },
  ...overrides,
})

describe('payment methods per currency', () => {
  it('reads a stored list, known methods only, once each, cards when empty', () => {
    expect(parsePaymentMethods('card, sepa_debit,sepa_debit,paypal')).toEqual(['card', 'sepa_debit'])
    expect(parsePaymentMethods(['SEPA_DEBIT'])).toEqual(['sepa_debit'])
    expect(parsePaymentMethods('')).toEqual(['card'])
    expect(parsePaymentMethods(null)).toEqual(['card'])
  })

  it('offers SEPA only in euros, and falls back to cards', () => {
    expect(paymentMethodsFor('card,sepa_debit', 'EUR')).toEqual(['card', 'sepa_debit'])
    expect(paymentMethodsFor('card,sepa_debit', 'usd')).toEqual(['card'])
    expect(paymentMethodsFor('sepa_debit', 'usd')).toEqual(['card'])
    expect(paymentMethodsFor('sepa_debit', 'eur')).toEqual(['sepa_debit'])
    expect(paymentMethodsFor('card,bacs_debit', 'gbp')).toEqual(['card', 'bacs_debit'])
  })

  it('knows the delayed methods', () => {
    expect(isDelayedPaymentMethod('sepa_debit')).toBe(true)
    expect(isDelayedPaymentMethod('card')).toBe(false)
    expect(isDelayedPaymentMethod('paypal')).toBe(false)
  })
})

describe('currency by country', () => {
  it('reads the region of a language tag', () => {
    expect(regionOfLocale('de-AT')).toBe('AT')
    expect(regionOfLocale('en_GB')).toBe('GB')
    expect(regionOfLocale('zh-Hant-TW')).toBe('TW')
    expect(regionOfLocale('de')).toBeNull()
    expect(regionOfLocale('es-419')).toBeNull()
    expect(regionOfLocale(undefined)).toBeNull()
  })

  it('pays in euros across the euro area, when the app sells in euros', () => {
    expect(currencyForCountry('DE', ['usd', 'eur'], 'usd')).toBe('eur')
    expect(currencyForCountry('at', ['USD', 'EUR'], 'usd')).toBe('eur')
    expect(currencyForCountry('BG', ['usd', 'eur'], 'usd')).toBe('eur')
    expect(currencyForCountry('US', ['usd', 'eur'], 'usd')).toBe('usd')
    expect(currencyForCountry('GB', ['usd', 'eur'], 'usd')).toBe('usd')
    expect(currencyForCountry('DE', ['usd'], 'usd')).toBe('usd')
    expect(currencyForCountry(null, ['usd', 'eur'], 'USD')).toBe('usd')
  })
})

describe('debits and mandates', () => {
  it('reads a SEPA charge: last four digits, mandate, expected debit date; never a card', () => {
    expect(debitDetailsOf(sepaCharge())).toEqual({ type: 'sepa_debit', mandateId: 'mandate_1', last4: '3000', bankCode: '37040044', country: 'DE', expectedDebitDate: '2026-10-20' })
    expect(debitDetailsOf({ payment_method_details: { type: 'card', card: { last4: '4242' } } })).toBeNull()
    // A payment method carries the same block under its type.
    expect(debitDetailsOf({ id: 'pm_1', type: 'sepa_debit', sepa_debit: { last4: '3000', country: 'DE' } })).toMatchObject({ type: 'sepa_debit', last4: '3000', mandateId: null })
  })

  it('reads a mandate\'s reference, page and status', async () => {
    const mandate = { id: 'mandate_1', status: 'active', payment_method_details: { type: 'sepa_debit', sepa_debit: { reference: 'ABC123XYZ', url: 'https://stripe.test/mandate' } } }
    expect(mandateReferenceOf(mandate)).toEqual({ id: 'mandate_1', reference: 'ABC123XYZ', url: 'https://stripe.test/mandate', status: 'active', type: 'sepa_debit' })
    expect(mandateReferenceOf(null)).toBeNull()
    const asked: string[] = []
    const stripe = { mandates: { retrieve: async (id: string) => { asked.push(id); return mandate } } }
    expect((await retrieveDebitMandate(stripe, 'mandate_1'))?.reference).toBe('ABC123XYZ')
    expect(await retrieveDebitMandate(stripe, '')).toBeNull()
    expect(asked).toEqual(['mandate_1'])
  })
})

describe('debit events', () => {
  it('reads Checkout\'s asynchronous results', () => {
    const session = { id: 'cs_1', payment_intent: 'pi_1', amount_total: 4900, currency: 'eur', metadata: { membership_id: '12' } }
    expect(debitEventOf({ type: 'checkout.session.completed', data: { object: { ...session, payment_status: 'unpaid' } } })).toMatchObject({ outcome: 'processing', checkoutSessionId: 'cs_1', paymentIntentId: 'pi_1', amount: 4900, metadata: { membership_id: '12' } })
    // A card checkout completes paid: nothing to wait for.
    expect(debitEventOf({ type: 'checkout.session.completed', data: { object: { ...session, payment_status: 'paid' } } })).toBeNull()
    expect(debitEventOf({ type: 'checkout.session.async_payment_succeeded', data: { object: session } })?.outcome).toBe('succeeded')
    expect(debitEventOf({ type: 'checkout.session.async_payment_failed', data: { object: session } })?.outcome).toBe('failed')
  })

  it('reads a debit\'s charge: pending, succeeded, failed with the bank\'s reason', () => {
    expect(debitEventOf({ type: 'charge.pending', data: { object: sepaCharge() } })).toMatchObject({ outcome: 'processing', method: 'sepa_debit', chargeId: 'ch_1', mandateId: 'mandate_1', amount: 4900, currency: 'eur' })
    expect(debitEventOf({ type: 'charge.succeeded', data: { object: sepaCharge() } })?.outcome).toBe('succeeded')
    expect(debitEventOf({ type: 'charge.failed', data: { object: sepaCharge({ failure_code: 'insufficient_funds', failure_message: 'Insufficient funds' }) } })).toMatchObject({ outcome: 'failed', failureCode: 'insufficient_funds', failureMessage: 'Insufficient funds' })
    expect(debitEventOf({ type: 'charge.succeeded', data: { object: { id: 'ch_2', payment_method_details: { type: 'card' } } } })).toBeNull()
  })

  it('reads a bank\'s return as a dispute, but not a card dispute', () => {
    expect(debitEventOf({ type: 'charge.dispute.created', data: { object: { id: 'dp_1', charge: 'ch_1', amount: 4900, currency: 'eur', reason: 'general' } } })).toMatchObject({ outcome: 'returned', chargeId: 'ch_1', amount: 4900, failureCode: 'general' })
    expect(debitEventOf({ type: 'charge.dispute.created', data: { object: { id: 'dp_2', charge: 'ch_2', payment_method_details: { type: 'card' } } } })).toBeNull()
  })

  it('reads a mandate that stopped working', () => {
    expect(debitEventOf({ type: 'mandate.updated', data: { object: { id: 'mandate_1', status: 'inactive', payment_method_details: { type: 'sepa_debit' } } } })).toMatchObject({ outcome: 'mandate_inactive', mandateId: 'mandate_1', method: 'sepa_debit' })
    expect(debitEventOf({ type: 'mandate.updated', data: { object: { id: 'mandate_1', status: 'active' } } })).toBeNull()
    expect(debitEventOf({ type: 'invoice.paid', data: { object: {} } })).toBeNull()
    expect(debitEventOf(null)).toBeNull()
  })

  it('says what a failed debit needs from the payer', () => {
    expect(debitFailureNextStep('insufficient_funds')).toBe('retry')
    expect(debitFailureNextStep('account_closed')).toBe('update')
    expect(debitFailureNextStep('debit_not_authorized')).toBe('update')
    expect(debitFailureNextStep('refer_to_customer')).toBe('contact')
    expect(debitFailureNextStep(undefined)).toBe('contact')
  })
})

describe('debit notices', () => {
  it('is due from the lead days before the debit until the debit', () => {
    const debitDate = '2026-11-01'
    expect(isDebitNoticeDue({ debitDate, today: '2026-10-26', leadDays: 5, method: 'sepa_debit' })).toBe(false)
    expect(isDebitNoticeDue({ debitDate, today: '2026-10-27', leadDays: 5, method: 'sepa_debit' })).toBe(true)
    expect(isDebitNoticeDue({ debitDate, today: '2026-10-31', leadDays: 5, method: 'sepa_debit' })).toBe(true)
    expect(isDebitNoticeDue({ debitDate, today: '2026-11-01', leadDays: 5, method: 'sepa_debit' })).toBe(false)
    // A lead shorter than SEPA's two days is raised to two.
    expect(isDebitNoticeDue({ debitDate, today: '2026-10-30', leadDays: 0, method: 'sepa_debit' })).toBe(true)
    expect(isDebitNoticeDue({ debitDate: 'soon', today: '2026-10-30', leadDays: 5 })).toBe(false)
  })

  it('knows a timely SEPA notice: two calendar days ahead at the latest', () => {
    expect(isDebitNoticeTimely({ sentOn: '2026-10-30', debitDate: '2026-11-01', method: 'sepa_debit' })).toBe(true)
    expect(isDebitNoticeTimely({ sentOn: '2026-10-31', debitDate: '2026-11-01', method: 'sepa_debit' })).toBe(false)
  })
})
