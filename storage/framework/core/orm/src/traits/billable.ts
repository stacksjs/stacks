import { db as _db } from '@stacksjs/database'
import type Stripe from 'stripe'

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

/**
 * Return shape for `newSubscription` / `updateSubscription` — pairs
 * the Stripe-side subscription with the most-recent payment intent so
 * callers can immediately handle 3DS / SCA flows without a second
 * round-trip to Stripe.
 */
export interface NewSubscriptionResult {
  subscription: Stripe.Response<Stripe.Subscription>
  paymentIntent?: Stripe.PaymentIntent
}

export interface ActiveSubscriptionResult {
  subscription: StoredSubscriptionRow
  providerSubscription: Stripe.Response<Stripe.Subscription>
}

export function createBillableMethods(_tableName: string) {
  const db = _db as any
  return {
    async createStripeUser(model: any, options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.createStripeCustomer(model, options)
    },

    async updateStripeUser(model: any, options: Stripe.CustomerUpdateParams): Promise<Stripe.Response<Stripe.Customer>> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.updateStripeCustomer(model, options)
    },

    async deleteStripeUser(model: any): Promise<Stripe.Response<Stripe.DeletedCustomer>> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.deleteStripeUser(model)
    },

    async createOrGetStripeUser(model: any, options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.createOrGetStripeUser(model, options)
    },

    async retrieveStripeUser(model: any): Promise<Stripe.Response<Stripe.Customer> | undefined> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.retrieveStripeUser(model)
    },

    async defaultPaymentMethod(model: any): Promise<Stripe.PaymentMethod | null> {
      const { managePaymentMethod } = await import('@stacksjs/payments')
      return await managePaymentMethod.retrieveDefaultPaymentMethod(model)
    },

    async setDefaultPaymentMethod(model: any, pmId: number): Promise<Stripe.Response<Stripe.Customer>> {
      const { managePaymentMethod } = await import('@stacksjs/payments')
      return await managePaymentMethod.setDefaultPaymentMethod(model, pmId)
    },

    async addPaymentMethod(model: any, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
      const { managePaymentMethod } = await import('@stacksjs/payments')
      return await managePaymentMethod.addPaymentMethod(model, paymentMethodId)
    },

    async paymentMethods(model: any, cardType?: string): Promise<Stripe.PaymentMethod[]> {
      const { managePaymentMethod } = await import('@stacksjs/payments')
      return await managePaymentMethod.listPaymentMethods(model, cardType)
    },

    async newSubscription(model: any, type: string, lookupKey: string, options: Partial<Stripe.SubscriptionCreateParams> = {}): Promise<NewSubscriptionResult> {
      const { manageSubscription } = await import('@stacksjs/payments')
      const subscription = await manageSubscription.create(model, type, lookupKey, options)
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
      const paymentIntent = (latestInvoice as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent })?.payment_intent
      return { subscription, paymentIntent }
    },

    async updateSubscription(model: any, type: string, lookupKey: string, options: Partial<Stripe.SubscriptionUpdateParams> = {}): Promise<NewSubscriptionResult> {
      const { manageSubscription } = await import('@stacksjs/payments')
      const subscription = await manageSubscription.update(model, type, lookupKey, options)
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null
      const paymentIntent = (latestInvoice as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent })?.payment_intent
      return { subscription, paymentIntent }
    },

    async cancelSubscription(model: any, providerId: string, options: Partial<Stripe.SubscriptionCancelParams> = {}): Promise<{ subscription: Stripe.Response<Stripe.Subscription> }> {
      const { manageSubscription } = await import('@stacksjs/payments')
      const subscription = await manageSubscription.cancel(providerId, options)
      return { subscription }
    },

    async activeSubscription(model: any): Promise<ActiveSubscriptionResult | undefined> {
      const { manageSubscription } = await import('@stacksjs/payments')
      const subscription = await db.selectFrom('subscriptions')
        .where('user_id', '=', model.id)
        .where('provider_status', '=', 'active')
        .selectAll()
        .executeTakeFirst() as StoredSubscriptionRow | undefined

      if (subscription) {
        const providerSubscription = await manageSubscription.retrieve(model, subscription.provider_id || '')
        return { subscription, providerSubscription }
      }

      return undefined
    },

    async checkout(model: any, priceIds: Array<{ priceId: string, quantity?: number }>, options: Partial<Stripe.Checkout.SessionCreateParams> & { enableTax?: boolean, allowPromotions?: boolean } = {}): Promise<Stripe.Response<Stripe.Checkout.Session>> {
      const { manageCheckout, manageCustomer } = await import('@stacksjs/payments')

      const newOptions: any = {}
      if (options.enableTax) {
        newOptions.automatic_tax = { enabled: true }
        delete options.enableTax
      }
      if (options.allowPromotions) {
        newOptions.allow_promotion_codes = true
        delete options.allowPromotions
      }

      const customer = await manageCustomer.createOrGetStripeUser(model, {})
      const defaultOptions = {
        mode: 'payment',
        customer: customer.id,
        line_items: priceIds.map((item: any) => ({
          price: item.priceId,
          quantity: item.quantity || 1,
        })),
      }

      const mergedOptions = { ...defaultOptions, ...newOptions, ...options }
      return await manageCheckout.create(model, mergedOptions)
    },

    async createSetupIntent(model: any, options: Stripe.SetupIntentCreateParams = {}): Promise<Stripe.Response<Stripe.SetupIntent>> {
      const { manageSetupIntent } = await import('@stacksjs/payments')
      return await manageSetupIntent.create(model, options)
    },

    async subscriptionHistory(model: any): Promise<Stripe.ApiList<Stripe.Invoice>> {
      const { manageInvoice } = await import('@stacksjs/payments')
      return await manageInvoice.list(model)
    },

    async transactionHistory(model: any): Promise<Stripe.ApiList<Stripe.BalanceTransaction>> {
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
        await (db as any).updateTable(tableName)
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
      const accCol = options.accountColumn || 'stripe_account_id'
      const chargesCol = options.chargesColumn || 'charges_enabled'
      const payoutsCol = options.payoutsColumn || 'payouts_enabled'
      const attrs = model._attributes ?? model
      const accountId = attrs[accCol] as string | undefined
      if (!accountId) return { chargesEnabled: false, payoutsEnabled: false }
      const stripe = await getStripe()
      const account = await stripe.accounts.retrieve(accountId)
      const chargesEnabled = !!(account as any).charges_enabled
      const payoutsEnabled = !!(account as any).payouts_enabled
      const tableName = options.modelTable || _tableName
      await (db as any).updateTable(tableName)
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

// Lazy-load Stripe so the trait stays free in projects that don't enable it.
async function getStripe(): Promise<Stripe> {
  const secret = (globalThis as { process?: { env?: { STRIPE_SECRET_KEY?: string } } }).process?.env?.STRIPE_SECRET_KEY
  if (!secret) throw new Error('Stripe Connect: STRIPE_SECRET_KEY not configured')
  const StripeCtor = (await import('stripe')).default
  return new StripeCtor(secret, { apiVersion: '2024-06-20' } as Stripe.StripeConfig)
}
