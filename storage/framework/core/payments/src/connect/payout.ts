import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { requireAccountId } from './account'

export interface ManagePayout {
  listPayouts: (accountId: string, params?: Stripe.PayoutListParams) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Payout>>>
  retrievePayout: (accountId: string, payoutId: string) => Promise<Stripe.Response<Stripe.Payout>>
  accountBalance: (accountId: string) => Promise<Stripe.Response<Stripe.Balance>>
}

/**
 * Payouts as the connected account sees them: bank transfers out of the
 * merchant's Stripe balance.
 *
 * Every call is made *as* the connected account (`stripeAccount`), not as the
 * platform. Listing payouts on the platform account instead returns the
 * platform's own bank transfers, which is a quietly wrong answer rather than an
 * error - a merchant statement page would render the platform's payouts and
 * nobody would notice until reconciliation.
 */
export const managePayout: ManagePayout = (() => {
  async function listPayouts(
    accountId: string,
    params: Stripe.PayoutListParams = {},
  ): Promise<Stripe.Response<Stripe.ApiList<Stripe.Payout>>> {
    requireAccountId(accountId, 'listPayouts')
    return await stripe.payouts.list(params, { stripeAccount: accountId })
  }

  async function retrievePayout(accountId: string, payoutId: string): Promise<Stripe.Response<Stripe.Payout>> {
    requireAccountId(accountId, 'retrievePayout')

    if (!payoutId || typeof payoutId !== 'string')
      throw new Error('[payments/connect] retrievePayout requires a payout id')

    return await stripe.payouts.retrieve(payoutId, {}, { stripeAccount: accountId })
  }

  /**
   * The merchant's balance, split into `available` (payable now) and `pending`
   * (still settling). A merchant asking "why haven't I been paid" is nearly
   * always looking at money that is still pending.
   */
  async function accountBalance(accountId: string): Promise<Stripe.Response<Stripe.Balance>> {
    requireAccountId(accountId, 'accountBalance')
    return await stripe.balance.retrieve({}, { stripeAccount: accountId })
  }

  return { listPayouts, retrievePayout, accountBalance }
})()
