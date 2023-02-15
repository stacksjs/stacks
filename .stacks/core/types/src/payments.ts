export interface PaymentOptions {
  drivers: {
    stripe: {
      key: env('STRIPE_API_KEY', 'pk_test')
    }
  }
}
