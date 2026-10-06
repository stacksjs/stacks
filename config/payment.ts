import type { PaymentConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Payment Configuration**
 *
 * This configuration defines all of your Payment options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  driver: 'stripe',

  stripe: {
    publishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
    secretKey: env.STRIPE_SECRET_KEY || '',
    // Verifies the account's webhook deliveries (checkout, subscriptions,
    // invoices) - the signing secret of the endpoint in your Stripe dashboard.
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
  },

  /**
   * Adyen, for `driver: 'adyen'`. Adyen has no product catalog, subscriptions,
   * invoices or billing portal; those calls throw naming the driver.
   */
  adyen: {
    apiKey: env.ADYEN_API_KEY || '',
    merchantAccount: env.ADYEN_MERCHANT_ACCOUNT || '',
    environment: env.ADYEN_ENVIRONMENT === 'live' ? 'live' : 'test',
    liveUrlPrefix: env.ADYEN_LIVE_URL_PREFIX || '',
    // The HMAC key of your standard webhook, which verifies its deliveries.
    hmacKey: env.ADYEN_HMAC_KEY || '',
  },

  /**
   * Paddle Billing, for `driver: 'paddle'`. Paddle is the merchant of record:
   * it charges and remits the tax, and reviews refunds. Set its default
   * payment link to this app's /payments/checkout page.
   */
  paddle: {
    apiKey: env.PADDLE_API_KEY || '',
    environment: env.PADDLE_ENVIRONMENT === 'live' ? 'live' : 'sandbox',
    // The secret key of your notification destination, which verifies its deliveries.
    webhookSecret: env.PADDLE_WEBHOOK_SECRET || '',
    // A client-side token, for Paddle.js on the checkout page.
    clientToken: env.PADDLE_CLIENT_TOKEN || '',
    taxCategory: env.PADDLE_TAX_CATEGORY || '',
  },

  /**
   * Marketplace payments. Off unless your app charges a customer on behalf of
   * a merchant. The Connect webhook endpoint has its own signing secret - the
   * account webhook secret above will not verify its deliveries.
   */
  connect: {
    enabled: env.STRIPE_CONNECT_ENABLED ?? false,
    platformFeePercent: env.STRIPE_CONNECT_FEE_PERCENT ?? 10,
    webhookSecret: env.STRIPE_CONNECT_WEBHOOK_SECRET || '',
  },

  // wip
} satisfies PaymentConfig
