import { createRequire } from 'node:module'
import { db as _db } from '@stacksjs/database/runtime'
import type {
  ChargeOptions,
  CheckoutRequest,
  CheckoutSession,
  ClientConfirmation,
  CreatePaymentOptions,
  Customer,
  ManageTransaction,
  Money,
  PaymentDriver,
  PaymentResult,
  StoredPaymentMethod,
  StoreTransactionOptions,
  SubscriptionSummary,
} from '@stacksjs/payments'
import type { StripeCustomerOptions } from '@stacksjs/types'
import type Stripe from 'stripe'

const require = createRequire(import.meta.url)

type StripeConstructor = typeof Stripe

/**
 * Thrown by `cancelSubscription` when the subscription is not the caller's:
 * unknown, or another user's. One error for both, so a caller probing ids
 * learns nothing about which exist.
 */
export class SubscriptionNotOwnedError extends Error {
  constructor(providerId: string) {
    super(`No subscription ${providerId} belongs to this user`)
    this.name = 'SubscriptionNotOwnedError'
  }
}

/**
 * Stored subscription row shape — narrower than `Record<string, unknown>`
 * so callers get autocompletion on the common fields without us
 * importing the full `subscriptions` model type (which would pull in
 * a circular @stacksjs/orm dependency). Keep in sync with the schema
 * in `database/src/custom/subscriptions.ts`.
 */
export interface StoredSubscriptionRow {
  id: number
  user_id: number
  type: string
  provider_id: string
  provider_status: string
  provider_price_id?: string
  unit_price?: number
  quantity?: number
  trial_ends_at?: string
  ends_at?: string
  provider_type?: string
  last_used_at?: string
}

export interface ActiveSubscriptionResult {
  subscription: StoredSubscriptionRow
  providerSubscription: SubscriptionSummary
}

/** The configured payment driver - Stripe unless `config.payment.driver` says otherwise. */
async function driver(): Promise<PaymentDriver> {
  const { paymentDriver } = await import('@stacksjs/payments')
  return paymentDriver()
}

/**
 * Refuse a Stripe-only method when the app is configured for another
 * provider, naming it. The check is the payments package's, shared with the
 * Payment facade, so both answer the same question the same way.
 */
async function requireStripe(operation: string): Promise<void> {
  const { assertStripeDriver } = await import('@stacksjs/payments')
  assertStripeDriver(operation)
}

export function createBillableMethods(_tableName: string) {
  const db = _db
  return {
    // ─── Provider-neutral: the configured payment driver ─────────────────
    // Money in minor units, results of our own (see `PaymentDriver`). These
    // used to return Stripe objects whatever `config.payment.driver` said.

    /** The provider's customer for this record, created on first use. */
    async paymentCustomer(model: any): Promise<Customer> {
      return (await driver()).customer(model)
    },

    /** Charge a stored payment method, server side. */
    async charge(model: any, amount: Money, paymentMethod: string, options: ChargeOptions = {}): Promise<PaymentResult> {
      return (await driver()).charge(model, amount, paymentMethod, options)
    },

    /**
     * Start a payment the browser completes on the provider's SDK: the result
     * carries a `clientConfirmation` (a Stripe client secret, an Adyen session).
     */
    async createPayment(model: any, amount: Money, options: CreatePaymentOptions = {}): Promise<PaymentResult> {
      return (await driver()).createPayment(model, amount, options)
    },

    /** A hosted checkout page; send the payer to `url`. */
    async checkout(model: any, request: CheckoutRequest): Promise<CheckoutSession> {
      return (await driver()).checkout(model, request)
    },

    /** The payment methods the provider holds for this record. */
    async paymentMethods(model: any): Promise<StoredPaymentMethod[]> {
      return (await driver()).paymentMethods(model)
    },

    async removePaymentMethod(model: any, paymentMethodId: string): Promise<void> {
      return (await driver()).removePaymentMethod(model, paymentMethodId)
    },

    /**
     * Subscribe to `price` (a Stripe lookup key). An incomplete subscription
     * comes back with a `clientConfirmation` for its first payment.
     */
    async newSubscription(model: any, type: string, price: string): Promise<SubscriptionSummary> {
      return (await driver()).subscribe(model, price, { type })
    },

    async cancelSubscription(model: any, providerId: string, options: { atPeriodEnd?: boolean } = {}): Promise<SubscriptionSummary> {
      // Only a subscription this record owns. `providerId` arrives from the
      // request body, and without this check any signed-in user could cancel
      // anyone's subscription by naming its id.
      const owned = await db.selectFrom('subscriptions')
        .where('provider_id', '=', providerId)
        .where('user_id', '=', model.id)
        .select(['id'])
        .executeTakeFirst()
      if (!owned)
        throw new SubscriptionNotOwnedError(providerId)

      return (await driver()).cancelSubscription(providerId, options)
    },

    async activeSubscription(model: any): Promise<ActiveSubscriptionResult | undefined> {
      const subscription = await db.selectFrom('subscriptions')
        .where('user_id', '=', model.id)
        .where('provider_status', '=', 'active')
        .selectAll()
        .executeTakeFirst() as StoredSubscriptionRow | undefined
      if (!subscription)
        return undefined

      const providerSubscription = (await (await driver()).subscriptions(model)).find(entry => entry.id === subscription.provider_id)
      return providerSubscription ? { subscription, providerSubscription } : undefined
    },

    // ─── Stripe only ─────────────────────────────────────────────────────
    // Stripe concepts with no counterpart elsewhere. Each refuses, naming the
    // provider, when `config.payment.driver` is not `stripe`.

    async syncStripeCustomerDetails(model: any, options: StripeCustomerOptions): Promise<Stripe.Response<Stripe.Customer>> {
      await requireStripe('syncStripeCustomerDetails')
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.syncStripeCustomerDetails(model, options)
    },

    async createStripeUser(model: any, options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
      await requireStripe('createStripeUser')
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.createStripeCustomer(model, options)
    },

    async updateStripeUser(model: any, options: Stripe.CustomerUpdateParams): Promise<Stripe.Response<Stripe.Customer>> {
      await requireStripe('updateStripeUser')
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.updateStripeCustomer(model, options)
    },

    async deleteStripeUser(model: any): Promise<Stripe.Response<Stripe.DeletedCustomer>> {
      await requireStripe('deleteStripeUser')
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.deleteStripeUser(model)
    },

    async createOrGetStripeUser(model: any, options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
      await requireStripe('createOrGetStripeUser')
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.createOrGetStripeUser(model, options)
    },

    async retrieveStripeUser(model: any): Promise<Stripe.Response<Stripe.Customer> | undefined> {
      await requireStripe('retrieveStripeUser')
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.retrieveStripeUser(model)
    },

    /** The local `payment_methods` row marked default, which Stripe card setup maintains. */
    async defaultPaymentMethod(model: any) {
      const { managePaymentMethod } = await import('@stacksjs/payments')
      return await managePaymentMethod.retrieveDefaultPaymentMethod(model)
    },

    /**
     * A number is the local `payment_methods` row; a string is Stripe's own
     * `pm_...` id, which is what a setup-intent callback hands back.
     */
    async setDefaultPaymentMethod(model: any, paymentMethod: number | string): Promise<void> {
      await requireStripe('setDefaultPaymentMethod')
      const { managePaymentMethod } = await import('@stacksjs/payments')
      if (typeof paymentMethod === 'string')
        await managePaymentMethod.setUserDefaultPayment(model, paymentMethod)
      else
        await managePaymentMethod.setDefaultPaymentMethod(model, paymentMethod)
    },

    /** Attach a card the browser collected with a Stripe SetupIntent, and record it locally. */
    async addPaymentMethod(model: any, paymentMethodId: string): Promise<StoredPaymentMethod> {
      await requireStripe('addPaymentMethod')
      const { managePaymentMethod, toStoredPaymentMethod } = await import('@stacksjs/payments')
      return toStoredPaymentMethod(await managePaymentMethod.addPaymentMethod(model, paymentMethodId))
    },

    /** Switch the active subscription to another price, prorated. */
    async updateSubscription(model: any, type: string, price: string): Promise<SubscriptionSummary> {
      await requireStripe('updateSubscription')
      const { manageSubscription, summarizeSubscription } = await import('@stacksjs/payments')
      return summarizeSubscription(await manageSubscription.update(model, type, price, {}))
    },

    /** A Stripe SetupIntent, for collecting a card in the browser without charging it. */
    async createSetupIntent(model: any, options: Stripe.SetupIntentCreateParams = {}): Promise<{ id: string, clientConfirmation: ClientConfirmation }> {
      await requireStripe('createSetupIntent')
      const { manageSetupIntent } = await import('@stacksjs/payments')
      const intent = await manageSetupIntent.create(model, options)
      if (!intent.client_secret)
        throw new Error('Stripe returned a SetupIntent without a client secret.')
      return { id: intent.id, clientConfirmation: { provider: 'stripe', clientSecret: intent.client_secret } }
    },

    async storeTransaction(model: any, productId: number, options: StoreTransactionOptions): ReturnType<ManageTransaction['store']> {
      const { manageTransaction } = await import('@stacksjs/payments')
      return await manageTransaction.store(model, productId, options)
    },

    async subscriptionHistory(model: any): Promise<Stripe.ApiList<Stripe.Invoice>> {
      await requireStripe('subscriptionHistory')
      const { manageInvoice } = await import('@stacksjs/payments')
      return await manageInvoice.list(model)
    },

    async transactionHistory(model: any) {
      const { manageTransaction } = await import('@stacksjs/payments')
      return await manageTransaction.list(model)
    },

    // ─── Stripe Connect (marketplace payouts) ────────────────────────────
    // Marketplaces with hosts/sellers/creators need a Stripe Connect Express
    // account per payee — these helpers wrap the standard onboarding +
    // status sync flow so app code doesn't have to write Stripe boilerplate.
    //
    // Storage convention: the model's `stripe_account_id`, `charges_enabled`,
    // and `payouts_enabled` columns track Connect state. Callers can override
    // via `options.accountColumn` etc. when the columns live elsewhere (e.g.
    // on a HostProfile rather than the User row).

    async connectAccount(model: any, options: { accountColumn?: string } = {}): Promise<Stripe.Account | null> {
      await requireStripe('Stripe Connect (connectAccount)')
      const col = options.accountColumn || 'stripe_account_id'
      const accountId = (model._attributes ?? model)[col] as string | undefined
      if (!accountId) return null
      const stripe = await getStripe()
      try { return await stripe.accounts.retrieve(accountId) } catch { return null }
    },

    async createConnectAccount(
      model: any,
      options: {
        type?: 'express' | 'standard' | 'custom'
        email?: string
        country?: string
        capabilities?: Record<string, { requested: boolean }>
        accountColumn?: string
        modelTable?: string
      } = {},
    ): Promise<Stripe.Account> {
      await requireStripe('Stripe Connect (createConnectAccount)')
      const col = options.accountColumn || 'stripe_account_id'
      const attrs = model._attributes ?? model
      let accountId = attrs[col] as string | undefined

      const stripe = await getStripe()
      if (!accountId) {
        // Idempotency-key the Connect account create (stacksjs/stacks#1876 X-1).
        // Without this, a retry after a successful Stripe call but
        // a failed local DB update produces a second Connect account
        // for the same user — orphaned in Stripe with no link to the
        // local model. The key is deterministic per-(model, table)
        // so retries return the original account.
        const { stacksIdempotencyKey } = await import('@stacksjs/payments')
        const tableName = options.modelTable || _tableName
        const account = await stripe.accounts.create({
          type: options.type ?? 'express',
          email: options.email ?? attrs.email,
          country: options.country ?? 'US',
          capabilities: options.capabilities ?? {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        }, {
          idempotencyKey: stacksIdempotencyKey('connect.account.create', tableName, attrs.id),
        })
        accountId = account.id
        await db.updateTable(tableName)
          .set({ [col]: accountId })
          .where('id', '=', Number(attrs.id))
          .execute()
        return account
      }

      return await stripe.accounts.retrieve(accountId)
    },

    async connectOnboardLink(
      model: any,
      options: {
        refreshUrl: string
        returnUrl: string
        type?: 'account_onboarding' | 'account_update'
        accountColumn?: string
      },
    ): Promise<{ url: string, accountId: string }> {
      await requireStripe('Stripe Connect (connectOnboardLink)')
      const col = options.accountColumn || 'stripe_account_id'
      const attrs = model._attributes ?? model
      const accountId = attrs[col] as string | undefined
      if (!accountId)
        throw new Error('connectOnboardLink: model has no Stripe Connect account; call createConnectAccount first')
      const stripe = await getStripe()
      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: options.refreshUrl,
        return_url: options.returnUrl,
        type: options.type ?? 'account_onboarding',
      })
      return { url: link.url, accountId }
    },

    async syncConnectStatus(
      model: any,
      options: {
        accountColumn?: string
        chargesColumn?: string
        payoutsColumn?: string
        modelTable?: string
      } = {},
    ): Promise<{ chargesEnabled: boolean, payoutsEnabled: boolean }> {
      await requireStripe('Stripe Connect (syncConnectStatus)')
      const accCol = options.accountColumn || 'stripe_account_id'
      const chargesCol = options.chargesColumn || 'charges_enabled'
      const payoutsCol = options.payoutsColumn || 'payouts_enabled'
      const attrs = model._attributes ?? model
      const accountId = attrs[accCol] as string | undefined
      if (!accountId) return { chargesEnabled: false, payoutsEnabled: false }
      const stripe = await getStripe()
      const account = await stripe.accounts.retrieve(accountId)
      const chargesEnabled = !!(account).charges_enabled
      const payoutsEnabled = !!(account).payouts_enabled
      const tableName = options.modelTable || _tableName
      await db.updateTable(tableName)
        .set({ [chargesCol]: chargesEnabled, [payoutsCol]: payoutsEnabled })
        .where('id', '=', Number(attrs.id))
        .execute()
      return { chargesEnabled, payoutsEnabled }
    },

    async chargeWithSplit(
      model: any,
      options: {
        amountCents: number
        currency?: string
        metadata?: Record<string, string>
        platformFeeCents?: number
        connectAccountId?: string // payee account; falls back to model's stripe_account_id
        accountColumn?: string
      },
    ): Promise<Stripe.Response<Stripe.PaymentIntent>> {
      await requireStripe('Stripe Connect (chargeWithSplit)')
      const stripe = await getStripe()
      const accCol = options.accountColumn || 'stripe_account_id'
      const attrs = model._attributes ?? model
      const destination = options.connectAccountId || (attrs[accCol] as string | undefined)
      const params: Stripe.PaymentIntentCreateParams = {
        amount: options.amountCents,
        currency: options.currency || 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: options.metadata,
      }
      if (destination) {
        params.transfer_data = { destination }
        if (options.platformFeeCents)
          params.application_fee_amount = options.platformFeeCents
      }
      // Fresh key per call — chargeWithSplit is one-shot (each call
      // is a new charge), but a single network retry within one
      // invocation benefits from Stripe-side in-flight idempotency
      // (stacksjs/stacks#1876 X-1). For deterministic retries across
      // separate invocations, callers should pass their own
      // `metadata.requestId` and key off it.
      const { freshIdempotencyKey } = await import('@stacksjs/payments')
      return await stripe.paymentIntents.create(params, {
        idempotencyKey: freshIdempotencyKey('payment_intent.create', attrs.id, options.amountCents),
      })
    },
  }
}

type BillableMethodBag = ReturnType<typeof createBillableMethods>

/**
 * A bag method as it is called on an instance: the proxy in `define-model.ts`
 * supplies the leading `model` itself, so the caller passes only the rest.
 * `never` in the model position matches any first parameter, whatever it is
 * declared as.
 */
// eslint-disable-next-line pickier/no-unused-vars
type BoundToModel<TMethod> = TMethod extends (model: never, ...args: infer TArgs) => infer TResult
  // eslint-disable-next-line pickier/no-unused-vars
  ? (...args: TArgs) => TResult
  : never

/**
 * What a hydrated instance of a `billable` model can do: `user.checkout(...)`,
 * `user.newSubscription(...)`, and the rest of the bag above.
 *
 * Derived from `createBillableMethods`, so a method added there is typed here
 * with no second declaration to keep in step.
 */
export type BillableMethods = { readonly [TName in keyof BillableMethodBag]: BoundToModel<BillableMethodBag[TName]> }

/**
 * Every bag method, as a value.
 *
 * Written as a record over the bag's keys rather than a list, so the compiler
 * rejects a missing name and a misspelled one alike. It is what the instance
 * proxy binds and what `isBillable` checks. Those used to be a hand-kept list
 * in `define-model.ts`, and the defaults were written against a surface that
 * list never had: `user.asStripeUser()`, `user.paymentIntent()` and five more
 * were called in shipped actions and threw "is not a function" every time.
 */
const BILLABLE_METHOD_NAMES: { readonly [TName in keyof BillableMethodBag]: true } = {
  syncStripeCustomerDetails: true,
  createStripeUser: true,
  updateStripeUser: true,
  deleteStripeUser: true,
  createOrGetStripeUser: true,
  retrieveStripeUser: true,
  defaultPaymentMethod: true,
  setDefaultPaymentMethod: true,
  removePaymentMethod: true,
  addPaymentMethod: true,
  paymentMethods: true,
  paymentCustomer: true,
  charge: true,
  newSubscription: true,
  updateSubscription: true,
  cancelSubscription: true,
  activeSubscription: true,
  checkout: true,
  createSetupIntent: true,
  createPayment: true,
  storeTransaction: true,
  subscriptionHistory: true,
  transactionHistory: true,
  connectAccount: true,
  createConnectAccount: true,
  connectOnboardLink: true,
  syncConnectStatus: true,
  chargeWithSplit: true,
}

export const BILLABLE_INSTANCE_METHODS: ReadonlyArray<keyof BillableMethods> = Object.freeze(
  Object.keys(BILLABLE_METHOD_NAMES) as Array<keyof BillableMethods>,
)

/**
 * Whether `model` carries the billable instance methods - which is to say,
 * whether it is a hydrated instance of a model that declares
 * `traits: { billable: true }`.
 *
 * A runtime check, not an assertion: the default User model leaves `billable`
 * off, so `request.user()` is billable only in an app that turned it on. Asking
 * lets a caller answer "billing is not enabled" rather than fail inside Stripe
 * code with "user.checkout is not a function".
 */
export function isBillable<TModel extends object>(model: TModel): model is TModel & BillableMethods {
  return BILLABLE_INSTANCE_METHODS.every(name => typeof Reflect.get(model, name) === 'function')
}

// Lazy-load Stripe so the trait stays free in projects that don't enable it.
// `createRequire` is deliberate: a literal dynamic import is statically
// resolved by Bun when a downstream application bundles @stacksjs/orm.
function getStripe(): Stripe {
  const secret = (globalThis as { process?: { env?: { STRIPE_SECRET_KEY?: string } } }).process?.env?.STRIPE_SECRET_KEY
  if (!secret) throw new Error('Stripe Connect: STRIPE_SECRET_KEY not configured')
  let StripeCtor: StripeConstructor
  try {
    StripeCtor = require('stripe') as StripeConstructor
  }
  catch {
    throw new Error(
      'Stripe Connect is being used but the `stripe` package is not installed. '
      + 'It is an opt-in dependency - run `bun add stripe` to enable Stripe Connect.',
    )
  }
  // The version the installed SDK's types describe, read from the SDK.
  return new StripeCtor(secret, { apiVersion: StripeCtor.API_VERSION })
}
