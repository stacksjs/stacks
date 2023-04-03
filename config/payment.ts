import { definePaymentConfig } from 'stacks/core/config/src'

/**
 * **Payment Configuration**
 *
 * This configuration defines all of your Payment options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default definePaymentConfig({
  driver: 'stripe',

  // ... other
})
