import type { PaymentConfig } from '@stacksjs/types'

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
    publishable_key: env.STRIPE_PUBLISHABLE_KEY || '',
    secret_key: env.STRIPE_SECRET_KEY || '',
  },

  // wip
} satisfies PaymentConfig
