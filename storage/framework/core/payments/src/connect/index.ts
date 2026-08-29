/**
 * Stripe Connect
 *
 * Marketplace payments: onboard merchants as connected accounts, charge the
 * customer on the platform while settling to the merchant, move money between
 * the two, and follow what Stripe pays out.
 *
 * Everything here is additive - an app that charges for itself never touches
 * it, and the `stripe` client stays lazily resolved, so importing
 * `@stacksjs/payments` still costs nothing when Stripe is not installed.
 */

export * from './account'
export * from './charge'
export * from './payout'
export * from './transfer'
export * from './webhook'

import { manageConnectedAccount } from './account'
import { manageDestinationCharge } from './charge'
import { managePayout } from './payout'
import { manageTransfer } from './transfer'
import { manageConnectWebhook } from './webhook'

/**
 * Grouped Connect surface, reached as `Payment.connect.*`.
 */
export const connect = {
  // Accounts
  createAccount: manageConnectedAccount.createConnectedAccount,
  createTestAccount: manageConnectedAccount.createTestConnectedAccount,
  onboardingLink: manageConnectedAccount.accountOnboardingLink,
  accountStatus: manageConnectedAccount.accountStatus,
  retrieveAccount: manageConnectedAccount.retrieveConnectedAccount,

  // Charges
  destinationCharge: manageDestinationCharge.destinationCharge,
  applicationFeeFor: manageDestinationCharge.applicationFeeFor,

  // Transfers
  createTransfer: manageTransfer.createTransfer,
  reverseTransfer: manageTransfer.reverseTransfer,
  listTransfers: manageTransfer.listTransfers,
  retrieveTransfer: manageTransfer.retrieveTransfer,

  // Payouts (as the connected account)
  listPayouts: managePayout.listPayouts,
  retrievePayout: managePayout.retrievePayout,
  accountBalance: managePayout.accountBalance,

  // Webhooks
  onAccount: manageConnectWebhook.onAccount,
  onPayout: manageConnectWebhook.onPayout,
  getAccount: manageConnectWebhook.getAccount,
  getPayout: manageConnectWebhook.getPayout,
  getConnectedAccountId: manageConnectWebhook.getConnectedAccountId,

  // Low-level access
  account: manageConnectedAccount,
  charge: manageDestinationCharge,
  transfer: manageTransfer,
  payout: managePayout,
}
