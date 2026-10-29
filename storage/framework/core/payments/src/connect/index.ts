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
export * from './destination'
export * from './direct'
export * from './financials'
export * from './invoice-fee'
export * from './invoice-credit'
export * from './tax'
export * from './invoice-tax'
export * from './payout'
export * from './refund'
export * from './subscription'
export * from './transfer'
export * from './webhook'

import { manageConnectedAccount } from './account'
import { manageDestinationCharge } from './charge'
import { asAccount, connectedCustomer, directCheckout, directCheckoutPaymentData, directCheckoutSubscriptionData, directPaymentIntentParams, directSubscriptionParams, manageDirectSubscription } from './direct'
import { checkoutLineItemsTotal, destinationCheckoutPaymentData, destinationCheckoutSubscriptionData, destinationFeeCents, destinationFeePercent, destinationPaymentIntentParams, destinationSubscriptionParams, splitFee } from './destination'
import { managePayout } from './payout'
import { directChargeFinancials } from './financials'
import { prepareDirectInvoiceFee } from './invoice-fee'
import { creditDirectInvoiceRefund } from './invoice-credit'
import { directInvoiceTaxFinancials } from './invoice-tax'
import { connectRefund, connectRefundParams, isDestinationCharge } from './refund'
import { manageDestinationSubscription } from './subscription'
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

  // Destination-charge params, pure (spread into the Stripe call you build)
  feeCents: destinationFeeCents,
  feePercent: destinationFeePercent,
  paymentIntentParams: destinationPaymentIntentParams,
  checkoutPaymentData: destinationCheckoutPaymentData,
  checkoutSubscriptionData: destinationCheckoutSubscriptionData,
  subscriptionParams: destinationSubscriptionParams,
  lineItemsTotal: checkoutLineItemsTotal,
  splitFee,

  // Direct charges: the sale on the merchant's own account, the platform's
  // cut an application fee (Stripe's Managed Risk). `asAccount(id)` makes any
  // Stripe call as the account.
  asAccount,
  customer: connectedCustomer,
  directCheckout,
  directChargeFinancials,
  prepareDirectInvoiceFee,
  creditDirectInvoiceRefund,
  directInvoiceTaxFinancials,
  directPaymentIntentParams,
  directCheckoutPaymentData,
  directCheckoutSubscriptionData,
  directSubscriptionParams,
  directSubscriptionCheckout: manageDirectSubscription.checkout,

  // Refunds that reverse the merchant's transfer and the platform's fee
  refund: connectRefund,
  refundParams: connectRefundParams,
  isDestinationCharge,

  // Subscriptions (billed on the platform, each invoice settled to the merchant)
  subscriptionCheckout: manageDestinationSubscription.checkout,
  subscriptionFeePercent: manageDestinationSubscription.feePercentFor,
  subscriptionDestination: manageDestinationSubscription.destinationOf,

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
  subscription: manageDestinationSubscription,
  directSubscription: manageDirectSubscription,
  transfer: manageTransfer,
  payout: managePayout,
}
