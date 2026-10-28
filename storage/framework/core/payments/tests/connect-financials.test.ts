import type Stripe from 'stripe'
import { describe, expect, test } from 'bun:test'
import { directChargeFinancials, DirectChargeFinancialsPendingError } from '../src/connect/financials'

function fixture() {
  const calls: Array<{ resource: string, params?: any, options?: any }> = []
  const charge: any = { id: 'ch_sale', payment_intent: 'pi_sale', paid: true, captured: true, amount: 10000, currency: 'eur', balance_transaction: 'txn_sale', application_fee: 'fee_hq', application_fee_amount: 1000 }
  const refund: any = { id: 're_one', charge: 'ch_sale', payment_intent: 'pi_sale', status: 'succeeded', balance_transaction: 'txn_refund' }
  const dispute: any = { id: 'du_one', charge: 'ch_sale', payment_intent: 'pi_sale', status: 'won', balance_transactions: ['txn_debit', 'txn_credit'] }
  const fee: any = { id: 'fee_hq', account: 'acct_original', charge: 'ch_sale', balance_transaction: 'txn_fee' }
  const feeRefund: any = { id: 'fr_one', fee: 'fee_hq', balance_transaction: 'txn_fee_refund' }
  const transactions: Record<string, any> = Object.fromEntries([
    ['txn_sale', 'ch_sale', 10000, 1300], ['txn_refund', 're_one', -5000, 0], ['txn_debit', 'du_one', -1000, 1500], ['txn_credit', 'du_one', 1000, 0], ['txn_fee', 'fee_hq', 1000, 0], ['txn_fee_refund', 'fr_one', -500, 0],
  ].map(([id, source, amount, fee]) => [id, { id, source, amount, fee, net: Number(amount) - Number(fee), currency: 'eur', exchange_rate: null, created: 1700000000 }]))
  const list = (resource: string, rows: any[]) => async (params: any, options?: any) => {
    calls.push({ resource, params, options })
    return { data: rows, has_more: false }
  }
  const api: any = {
    paymentIntents: { retrieve: async (_id: string, params: any, options: any) => { calls.push({ resource: 'intent', params, options }); return { id: 'pi_sale', status: 'succeeded', latest_charge: 'ch_sale' } } },
    charges: { retrieve: async (_id: string, params: any, options: any) => { calls.push({ resource: 'charge', params, options }); return charge } },
    refunds: { list: list('refunds', [refund]) },
    disputes: { list: list('disputes', [dispute]) },
    applicationFees: {
      retrieve: async (_id: string, params?: any, options?: any) => { calls.push({ resource: 'fee', params, options }); return fee },
      list: list('fees', [fee]),
      listRefunds: async (_id: string, params: any, options?: any) => list('feeRefunds', [feeRefund])(params, options),
    },
    balanceTransactions: { retrieve: async (id: string, params: any, options: any) => { calls.push({ resource: `movement:${id}`, params, options }); return transactions[id] } },
  }
  return { api, calls, charge, refund, dispute, fee, feeRefund, transactions, load: () => directChargeFinancials('pi_sale', 'acct_original', api as Stripe) }
}

describe('direct-charge canonical financials', () => {
  test('reads payment/refund/dispute balances on the original merchant and application fees on the platform', async () => {
    const f = fixture()
    const result = await f.load()
    expect(result.movements).toHaveLength(6)
    expect(result.disputes[0]!.status).toBe('won')
    expect(result.movements.find(row => row.transaction.id === 'txn_debit')!.transaction.fee).toBe(1500)
    for (const call of f.calls) {
      const platform = ['fee', 'feeRefunds', 'movement:txn_fee', 'movement:txn_fee_refund'].includes(call.resource)
      expect(call.options?.stripeAccount).toBe(platform ? undefined : 'acct_original')
    }
  })

  test('paginates instead of trusting the ten refunds embedded in a charge', async () => {
    const f = fixture()
    f.api.refunds.list = async (params: any, options: any) => {
      expect(options.stripeAccount).toBe('acct_original')
      expect(params.charge).toBe('ch_sale')
      expect(params.limit).toBe(100)
      return params.starting_after ? { data: [{ ...f.refund, id: 're_two', status: 'pending', balance_transaction: null }], has_more: false } : { data: [f.refund], has_more: true }
    }
    expect((await f.load()).refunds.map(row => row.id)).toEqual(['re_one', 're_two'])
  })

  test('does not turn an asynchronously missing application fee or balance movement into zero', async () => {
    const f = fixture()
    f.charge.application_fee = null
    f.api.applicationFees.list = async () => ({ data: [], has_more: false })
    await expect(f.load()).rejects.toBeInstanceOf(DirectChargeFinancialsPendingError)
    f.charge.application_fee = 'fee_hq'
    f.charge.balance_transaction = null
    await expect(f.load()).rejects.toBeInstanceOf(DirectChargeFinancialsPendingError)
  })

  test('allows a genuinely fee-free charge without resolving any platform fee', async () => {
    const f = fixture()
    f.charge.application_fee = null
    f.charge.application_fee_amount = 0
    expect((await f.load()).applicationFee).toBeNull()
    expect(f.calls.some(call => call.resource === 'fee')).toBe(false)
  })

  test('rejects foreign references throughout the graph', async () => {
    for (const corrupt of [
      (f: ReturnType<typeof fixture>) => { f.charge.payment_intent = 'pi_foreign' },
      (f: ReturnType<typeof fixture>) => { f.refund.charge = 'ch_foreign' },
      (f: ReturnType<typeof fixture>) => { f.dispute.payment_intent = 'pi_foreign' },
      (f: ReturnType<typeof fixture>) => { f.fee.account = 'acct_foreign' },
      (f: ReturnType<typeof fixture>) => { f.fee.charge = 'ch_foreign' },
      (f: ReturnType<typeof fixture>) => { f.feeRefund.fee = 'fee_foreign' },
      (f: ReturnType<typeof fixture>) => { f.transactions.txn_sale.source = 'ch_foreign' },
    ]) {
      const f = fixture()
      corrupt(f)
      await expect(f.load()).rejects.toThrow()
    }
  })

  test('fails repeated or empty continuation pages rather than returning an incomplete ledger', async () => {
    for (const rows of [[], [fixture().refund]]) {
      const f = fixture()
      f.api.refunds.list = async (params: any) => ({ data: params.starting_after ? rows : [f.refund], has_more: true })
      await expect(f.load()).rejects.toThrow(/page/)
    }
  })

  test('keeps actual foreign settlement amounts and exchange rates unchanged', async () => {
    const f = fixture()
    Object.assign(f.transactions.txn_sale, { amount: 12340, fee: 1604, net: 10736, currency: 'usd', exchange_rate: 1.234 })
    const actual = (await f.load()).movements[0]!.transaction
    expect(actual.currency).toBe('usd')
    expect(actual.amount).toBe(12340)
    expect(actual.exchange_rate).toBe(1.234)
  })
})
