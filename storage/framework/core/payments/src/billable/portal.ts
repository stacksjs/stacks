import type { SaasPortal } from '@stacksjs/types'
import type Stripe from 'stripe'
import { app } from '@stacksjs/config'
import { stripe } from '../drivers/stripe'

/**
 * The Stripe customer portal: a Stripe-hosted page where a customer cancels or
 * changes a subscription, updates the card on file and downloads invoices.
 *
 * `buddy stripe:setup` keeps one portal configuration in the account to match
 * `config/saas.ts` (`portal`), tagged with this app's name so it is found again
 * among any others the account holds - one Stripe account commonly serves
 * several apps. A session then uses it, or the account's default when the app
 * declares no portal.
 */

/** The metadata that marks a portal configuration as this app's. */
export function managedPortalTag(appName: string = app?.name || 'stacks'): Record<string, string> {
  return { managed_by: 'stacks', stacks_app: appName }
}

/** What `config/saas.ts` asks the portal to allow, as Stripe configuration params. */
export function portalConfigurationParams(portal: SaasPortal, appName?: string): Stripe.BillingPortal.ConfigurationCreateParams {
  const emailUpdate = portal.emailUpdate !== false
  const cancel = portal.cancel ?? 'at_period_end'
  const businessProfile: Stripe.BillingPortal.ConfigurationCreateParams.BusinessProfile = {}
  if (portal.headline)
    businessProfile.headline = portal.headline
  if (portal.privacyPolicyUrl)
    businessProfile.privacy_policy_url = portal.privacyPolicyUrl
  if (portal.termsOfServiceUrl)
    businessProfile.terms_of_service_url = portal.termsOfServiceUrl

  return {
    features: {
      customer_update: emailUpdate ? { enabled: true, allowed_updates: ['email'] } : { enabled: false },
      invoice_history: { enabled: portal.invoiceHistory !== false },
      payment_method_update: { enabled: portal.paymentMethodUpdate !== false },
      subscription_cancel: cancel === false ? { enabled: false } : { enabled: true, mode: cancel },
    },
    ...(Object.keys(businessProfile).length ? { business_profile: businessProfile } : {}),
    ...(portal.returnUrl ? { default_return_url: portal.returnUrl } : {}),
    metadata: managedPortalTag(appName),
  }
}

/**
 * Whether a live configuration already allows exactly what the params ask for,
 * so a re-run of `stripe:setup` writes nothing.
 */
export function portalConfigurationMatches(live: Stripe.BillingPortal.Configuration, params: Stripe.BillingPortal.ConfigurationCreateParams): boolean {
  const want = params.features
  const have = live.features
  const cancelWanted = want.subscription_cancel
  return have.invoice_history.enabled === want.invoice_history?.enabled
    && have.payment_method_update.enabled === want.payment_method_update?.enabled
    && have.customer_update.enabled === want.customer_update?.enabled
    && have.subscription_cancel.enabled === cancelWanted?.enabled
    && (!cancelWanted?.enabled || have.subscription_cancel.mode === cancelWanted.mode)
    && (live.default_return_url ?? undefined) === (params.default_return_url || undefined)
    && (live.business_profile.headline ?? undefined) === (params.business_profile?.headline || undefined)
}

/** This app's portal configuration, if `stripe:setup` has made one. */
export async function findManagedPortalConfiguration(appName?: string, client: Pick<Stripe, 'billingPortal'> = stripe): Promise<Stripe.BillingPortal.Configuration | undefined> {
  const tag = managedPortalTag(appName)
  for await (const configuration of client.billingPortal.configurations.list({ active: true, limit: 100 })) {
    if (configuration.metadata?.managed_by === tag.managed_by && configuration.metadata?.stacks_app === tag.stacks_app)
      return configuration
  }
  return undefined
}

export interface BillingPortalOptions {
  /** Where the portal's "Return to" link goes. Needed unless `portal.returnUrl` is set. */
  returnUrl?: string
}

export const manageBillingPortal = {
  /**
   * A one-time link into the portal for `customerId`. Send the customer to
   * `session.url`; it expires after a few minutes, so create one per visit.
   */
  async createSession(customerId: string, options: BillingPortalOptions = {}): Promise<Stripe.BillingPortal.Session> {
    const configuration = await findManagedPortalConfiguration()
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      ...(options.returnUrl ? { return_url: options.returnUrl } : {}),
      ...(configuration ? { configuration: configuration.id } : {}),
    })
  },
}
