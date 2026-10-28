import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { asAccount } from './direct'

export interface DirectChargeMovement {
  account: string | 'platform'
  sourceId: string
  kind: 'charge' | 'refund' | 'dispute' | 'application_fee' | 'application_fee_refund'
  transaction: Stripe.BalanceTransaction
}

/** Server-only provider facts. Settlement amounts retain their own currency and
 * exchange rate; they are not contributor allocations or available funds. */
export interface DirectChargeFinancials {
  account: string
  charge: Stripe.Charge
  refunds: Stripe.Refund[]
  disputes: Stripe.Dispute[]
  applicationFee: Stripe.ApplicationFee | null
  applicationFeeRefunds: Stripe.FeeRefund[]
  movements: DirectChargeMovement[]
}

/** Stripe creates application fees/balance transactions asynchronously. Retry
 * through the caller's durable queue; absence must never mean a zero fee. */
export class DirectChargeFinancialsPendingError extends Error {}

function id(value: unknown): string {
  return typeof value === 'string' ? value : String((value as { id?: string } | null)?.id || '')
}

async function allPages<T extends { id: string }>(read: (after?: string) => Promise<{ data: T[], has_more: boolean }>): Promise<T[]> {
  const rows: T[] = []
  const seen = new Set<string>()
  let after: string | undefined
  for (let page = 0; page < 100; page++) {
    const result = await read(after)
    for (const row of result.data) {
      if (!row.id || seen.has(row.id)) throw new Error('Incomplete or repeated Stripe financial page')
      seen.add(row.id)
      rows.push(row)
    }
    if (!result.has_more) return rows
    if (!result.data.length) throw new Error('Incomplete Stripe financial page')
    after = result.data.at(-1)!.id
  }
  throw new Error('Stripe financial pagination exceeded its bound')
}

/** Retrieve current facts on the ORIGINAL direct-charge account. Call after
 * acquiring the application's payment lock, not before it. Every list is fully
 * paginated; platform application fees never use the connected-account header.
 * No writes, transfers, credentials, or event-snapshot state are accepted.
 * https://docs.stripe.com/connect/direct-charges
 */
export async function directChargeFinancials(paymentIntentId: string, account: string, client: Stripe = stripe): Promise<DirectChargeFinancials> {
  const options = asAccount(account)
  if (!/^pi_[a-z0-9_]+$/i.test(paymentIntentId)) throw new Error('Expected a Stripe PaymentIntent ID')
  const intent = await client.paymentIntents.retrieve(paymentIntentId, {}, options)
  if (intent.id !== paymentIntentId || intent.status !== 'succeeded' || !id(intent.latest_charge)) throw new DirectChargeFinancialsPendingError('The original payment has no successful charge yet')
  const charge = await client.charges.retrieve(id(intent.latest_charge), {}, options)
  if (id(charge.payment_intent) !== paymentIntentId || charge.id !== id(intent.latest_charge) || !charge.paid || !charge.captured) throw new Error('Charge does not match the successful direct payment')
  const refunds = await allPages<Stripe.Refund>(after => client.refunds.list({ charge: charge.id, limit: 100, ...(after ? { starting_after: after } : {}) }, options))
  const disputes = await allPages<Stripe.Dispute>(after => client.disputes.list({ charge: charge.id, limit: 100, ...(after ? { starting_after: after } : {}) }, options))
  for (const item of [...refunds, ...disputes]) {
    if (id(item.charge) !== charge.id || (item.payment_intent && id(item.payment_intent) !== paymentIntentId)) throw new Error('Foreign refund or dispute in direct-charge financials')
  }
  let applicationFee: Stripe.ApplicationFee | null = null
  if (id(charge.application_fee)) applicationFee = await client.applicationFees.retrieve(id(charge.application_fee))
  else if (Number(charge.application_fee_amount) > 0) {
    const fees = await allPages<Stripe.ApplicationFee>(after => client.applicationFees.list({ charge: charge.id, limit: 100, ...(after ? { starting_after: after } : {}) }))
    if (fees.length !== 1) throw new DirectChargeFinancialsPendingError('The direct-charge application fee is not available yet')
    applicationFee = fees[0]!
  }
  if (applicationFee && (id(applicationFee.account) !== account || id(applicationFee.charge) !== charge.id)) throw new Error('Application fee belongs to another direct charge or account')
  const applicationFeeRefunds = applicationFee ? await allPages<Stripe.FeeRefund>(after => client.applicationFees.listRefunds(applicationFee!.id, { limit: 100, ...(after ? { starting_after: after } : {}) })) : []
  if (applicationFeeRefunds.some(refund => id(refund.fee) !== applicationFee!.id)) throw new Error('Foreign application-fee refund')
  const movements: DirectChargeMovement[] = []
  const seen = new Map<string, DirectChargeMovement>()
  async function movement(reference: unknown, sourceId: string, kind: DirectChargeMovement['kind'], scope: string, required = true) {
    const transactionId = id(reference)
    if (!transactionId) {
      if (required) throw new DirectChargeFinancialsPendingError('A provider balance transaction is not available yet')
      return
    }
    if (!/^txn_[a-z0-9_]+$/i.test(transactionId)) throw new Error('Invalid provider balance transaction')
    const transaction = await client.balanceTransactions.retrieve(transactionId, {}, scope === 'platform' ? undefined : options)
    if (transaction.id !== transactionId || (id(transaction.source) && id(transaction.source) !== sourceId)) throw new Error('Foreign provider balance transaction')
    const entry: DirectChargeMovement = { account: scope, sourceId, kind, transaction }
    const key = `${scope}:${transactionId}`
    if (seen.has(key)) {
      if (JSON.stringify(seen.get(key)) !== JSON.stringify(entry)) throw new Error('Conflicting provider balance transaction')
      return
    }
    seen.set(key, entry)
    movements.push(entry)
  }
  await movement(charge.balance_transaction, charge.id, 'charge', account)
  for (const refund of refunds) {
    await movement(refund.balance_transaction, refund.id, 'refund', account, refund.status === 'succeeded')
    await movement(refund.failure_balance_transaction, refund.id, 'refund', account, false)
  }
  for (const dispute of disputes)
    for (const transaction of dispute.balance_transactions) await movement(transaction, dispute.id, 'dispute', account)
  if (applicationFee) await movement(applicationFee.balance_transaction, applicationFee.id, 'application_fee', 'platform')
  for (const refund of applicationFeeRefunds) await movement(refund.balance_transaction, refund.id, 'application_fee_refund', 'platform')
  return { account, charge, refunds, disputes, applicationFee, applicationFeeRefunds, movements }
}
