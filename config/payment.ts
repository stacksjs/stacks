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
