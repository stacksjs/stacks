import { type PaymentOptions } from '@stacksjs/types'

export default <PaymentOptions> {
  drivers: {
    stripe: {
      key: env('STRIPE_API_KEY', 'pk_test'),
    },
  },
}
