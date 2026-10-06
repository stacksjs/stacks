import { route } from '@stacksjs/router'

/**
 * The page a Paddle payment link opens (stacksjs/stacks#665). Set Paddle's
 * default payment link (Checkout > Checkout settings) to
 * `https://<your app>/payments/checkout`: Paddle appends the transaction as
 * `?_ptxn=`, and this page opens Paddle.js on it with the success page
 * `Payment.checkout()` stored on the transaction.
 *
 * Mounted while `config.payment.driver` is `paddle`. An app route at the same
 * path registers first and wins.
 */
route.get('/payments/checkout', async (request) => {
  const { servePaddleCheckout } = await import('@stacksjs/payments')
  return servePaddleCheckout(request)
})

route.get('/payments/checkout.js', async () => {
  const { servePaddleCheckoutScript } = await import('@stacksjs/payments')
  return servePaddleCheckoutScript()
})
