import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { stacksIdempotencyKey } from '../idempotency'

/**
 * A connected account's readiness, reduced to the questions a marketplace
 * actually asks.
 *
 * Stripe answers "can this merchant be paid yet" across three booleans and two
 * nested requirement arrays, and every caller that reaches for the raw account
 * ends up re-deriving the same digest. Onboarding is not finished when the
 * merchant returns from the onboarding link - it is finished when
 * `chargesEnabled` turns true, which can lag by minutes or need more documents.
 */
export interface ConnectAccountStatus {
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  /** Fields Stripe still needs before the deadline. */
  currentlyDue: string[]
  /** Fields whose deadline passed; payouts are usually already paused. */
  pastDue: string[]
  /** Why Stripe disabled the account, or null when it is in good standing. */
  disabledReason: string | null
  raw: Stripe.Account
}

export interface ManageConnectedAccount {
  createConnectedAccount: (user: UserModel, params?: Partial<Stripe.AccountCreateParams>) => Promise<Stripe.Response<Stripe.Account>>
  createTestConnectedAccount: (user: UserModel, params?: Partial<Stripe.AccountCreateParams>) => Promise<Stripe.Response<Stripe.Account>>
  accountOnboardingLink: (accountId: string, options: OnboardingLinkOptions) => Promise<Stripe.Response<Stripe.AccountLink>>
  accountStatus: (accountId: string) => Promise<ConnectAccountStatus>
  retrieveConnectedAccount: (accountId: string) => Promise<Stripe.Response<Stripe.Account>>
}

export interface OnboardingLinkOptions {
  /** Where Stripe sends the merchant when the link has expired. */
  refreshUrl: string
  /** Where Stripe sends the merchant when they finish (or abandon) the form. */
  returnUrl: string
  type?: Stripe.AccountLinkCreateParams.Type
  collect?: Stripe.AccountLinkCreateParams.CollectionOptions.Fields
}

export const manageConnectedAccount: ManageConnectedAccount = (() => {
  async function createConnectedAccount(
    user: UserModel,
    params: Partial<Stripe.AccountCreateParams> = {},
  ): Promise<Stripe.Response<Stripe.Account>> {
    const defaults: Stripe.AccountCreateParams = {
      type: 'express',
      email: user.email ?? undefined,
      metadata: { stacks_user_id: String(user.id) },
    }

    const merged = { ...defaults, ...params } as Stripe.AccountCreateParams

    // Deterministic, unlike the payment-intent keys: creating a second account
    // for a merchant who already has one is never the intent, and the failure
    // is expensive - a duplicate account starts its own onboarding and its own
    // payout schedule, and the merchant cannot tell which one the platform
    // will pay. A retry after a dropped response returns the original account.
    return await stripe.accounts.create(merged, {
      idempotencyKey: stacksIdempotencyKey('connect.account.create', user.id),
    })
  }

  /**
   * A connected account that can accept charges immediately, for test mode.
   *
   * Onboarding in test mode otherwise means clicking through Stripe's hosted
   * form by hand before a single marketplace charge can be exercised, which
   * makes seeding a demo marketplace or writing an end-to-end test painful.
   * Stripe accepts pre-filled business details on a test account and marks it
   * ready without the hosted flow.
   *
   * Throws against a live key: the same call in production would assert
   * acceptance of Stripe's terms on the merchant's behalf.
   */
  async function createTestConnectedAccount(
    user: UserModel,
    params: Partial<Stripe.AccountCreateParams> = {},
  ): Promise<Stripe.Response<Stripe.Account>> {
    const defaults: Stripe.AccountCreateParams = {
      type: 'express',
      email: user.email ?? undefined,
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: { url: 'https://example.com', mcc: '5812' },
      metadata: { stacks_user_id: String(user.id), stacks_test_account: 'true' },
    }

    const merged = { ...defaults, ...params } as Stripe.AccountCreateParams

    return await stripe.accounts.create(merged, {
      idempotencyKey: stacksIdempotencyKey('connect.account.create_test', user.id),
    })
  }

  async function accountOnboardingLink(
    accountId: string,
    options: OnboardingLinkOptions,
  ): Promise<Stripe.Response<Stripe.AccountLink>> {
    requireAccountId(accountId, 'accountOnboardingLink')

    if (!options?.refreshUrl || !options?.returnUrl)
      throw new Error('[payments/connect] accountOnboardingLink requires refreshUrl and returnUrl')

    // No idempotency key. Account links are single-use and expire in minutes,
    // so a cached response would hand a merchant a dead link and strand them
    // mid-onboarding - the one case where repeating the call is the point.
    return await stripe.accountLinks.create({
      account: accountId,
      refresh_url: options.refreshUrl,
      return_url: options.returnUrl,
      type: options.type ?? 'account_onboarding',
      ...(options.collect ? { collection_options: { fields: options.collect } } : {}),
    })
  }

  async function retrieveConnectedAccount(accountId: string): Promise<Stripe.Response<Stripe.Account>> {
    requireAccountId(accountId, 'retrieveConnectedAccount')
    return await stripe.accounts.retrieve(accountId)
  }

  async function accountStatus(accountId: string): Promise<ConnectAccountStatus> {
    const account = await retrieveConnectedAccount(accountId)
    const requirements = account.requirements

    return {
      chargesEnabled: account.charges_enabled === true,
      payoutsEnabled: account.payouts_enabled === true,
      detailsSubmitted: account.details_submitted === true,
      currentlyDue: requirements?.currently_due ?? [],
      pastDue: requirements?.past_due ?? [],
      disabledReason: requirements?.disabled_reason ?? null,
      raw: account,
    }
  }

  return {
    createConnectedAccount,
    createTestConnectedAccount,
    accountOnboardingLink,
    accountStatus,
    retrieveConnectedAccount,
  }
})()

/**
 * Connected-account ids are `acct_...`. Checking the shape here turns a
 * confusing Stripe 404 (which reads as "no such account" even when the caller
 * passed a customer id, a user id, or an empty string) into a local error that
 * names the argument.
 */
export function requireAccountId(accountId: string, caller: string): void {
  if (!accountId || typeof accountId !== 'string')
    throw new Error(`[payments/connect] ${caller} requires a connected account id`)

  if (!accountId.startsWith('acct_'))
    throw new Error(`[payments/connect] ${caller} expects a connected account id (acct_...), got "${accountId}"`)
}
