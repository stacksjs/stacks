import type Stripe from 'stripe'
import { config } from '@stacksjs/config'
import { stripe } from '../drivers/stripe'
import { freshIdempotencyKey } from '../idempotency'
import { requireAccountId } from './account'

function defaultCurrency(): string {
  const cfg = (config as { payment?: { currency?: string }, billing?: { currency?: string } }) || {}
  const fromConfig = cfg.payment?.currency || cfg.billing?.currency
  return (fromConfig || process.env.STRIPE_CURRENCY || 'usd').toLowerCase()
}

export interface CreateTransferOptions {
  /** Minor units, like every other amount in this package. */
  amount: number
  destination: string
  currency?: string
  transferGroup?: string
  /**
   * The charge these funds came from. Stripe then draws on that charge's
   * balance rather than the platform's general balance, which is what keeps a
   * payout from being blocked by pending settlement.
   */
  sourceTransaction?: string
  description?: string
  metadata?: Stripe.MetadataParam
}

export interface ManageTransfer {
  createTransfer: (options: CreateTransferOptions) => Promise<Stripe.Response<Stripe.Transfer>>
  reverseTransfer: (transferId: string, amount?: number) => Promise<Stripe.Response<Stripe.TransferReversal>>
  listTransfers: (params?: Stripe.TransferListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Transfer>>>
  retrieveTransfer: (transferId: string) => Promise<Stripe.Response<Stripe.Transfer>>
}

/**
 * Separate transfers, for money movement that is not tied to a single charge at
 * the moment the customer pays.
 *
 * `destinationCharge` covers the common marketplace case. This is the other
 * one: paying a courier their accumulated earnings, settling a merchant weekly
 * rather than per order, or splitting one charge across several recipients.
 */
export const manageTransfer: ManageTransfer = (() => {
  async function createTransfer(options: CreateTransferOptions): Promise<Stripe.Response<Stripe.Transfer>> {
    requireAccountId(options?.destination, 'createTransfer')

    if (!Number.isFinite(options.amount) || options.amount <= 0)
      throw new Error('[payments/connect] createTransfer requires a positive amount in minor units')

    const params: Stripe.TransferCreateParams = {
      amount: Math.floor(options.amount),
      currency: (options.currency ?? defaultCurrency()).toLowerCase(),
      destination: options.destination,
      ...(options.transferGroup ? { transfer_group: options.transferGroup } : {}),
      ...(options.sourceTransaction ? { source_transaction: options.sourceTransaction } : {}),
      ...(options.description ? { description: options.description } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    }

    return await stripe.transfers.create(params, {
      idempotencyKey: freshIdempotencyKey('connect.transfer.create', options.destination, options.amount),
    })
  }

  /**
   * Claw back a transfer, in full or in part.
   *
   * Refunding a destination charge does not by itself pull the money back from
   * the merchant - the platform eats the refund unless the transfer is reversed
   * too. A marketplace that refunds an order almost always wants both.
   */
  async function reverseTransfer(transferId: string, amount?: number): Promise<Stripe.Response<Stripe.TransferReversal>> {
    if (!transferId || typeof transferId !== 'string')
      throw new Error('[payments/connect] reverseTransfer requires a transfer id')

    if (amount != null && (!Number.isFinite(amount) || amount <= 0))
      throw new Error('[payments/connect] reverseTransfer amount must be a positive number of minor units')

    const params: Stripe.TransferCreateReversalParams = amount == null
      ? {}
      : { amount: Math.floor(amount) }

    // Deterministic: a reversal repeated after a timeout must not take the
    // money twice, and "reverse this much of this transfer" is the same
    // instruction however often it is sent.
    return await stripe.transfers.createReversal(transferId, params, {
      idempotencyKey: `stacks:connect.transfer.reverse:${transferId}:${amount ?? 'full'}:v1`,
    })
  }

  async function listTransfers(params: Stripe.TransferListParams = {}): Promise<Stripe.Response<Stripe.ApiList<Stripe.Transfer>>> {
    return await stripe.transfers.list(params)
  }

  async function retrieveTransfer(transferId: string): Promise<Stripe.Response<Stripe.Transfer>> {
    if (!transferId || typeof transferId !== 'string')
      throw new Error('[payments/connect] retrieveTransfer requires a transfer id')

    return await stripe.transfers.retrieve(transferId)
  }

  return { createTransfer, reverseTransfer, listTransfers, retrieveTransfer }
})()
