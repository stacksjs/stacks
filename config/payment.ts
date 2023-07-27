import { definePayment } from '../.stacks/core/types/src/payments'

/**
 * **Payment Configuration**
 *
 * This configuration defines all of your Payment options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default definePayment({
  driver: 'stripe',

  // ... other
})
