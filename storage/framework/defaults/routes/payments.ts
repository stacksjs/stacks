import { orders } from '@stacksjs/commerce'
import { route } from '@stacksjs/router'

/**
 * The payment provider's webhook (stacksjs/stacks#665, #1879 Co-17).
 *
 * Point the provider at `POST /webhooks/payments`: Stripe's endpoint with its
 * signing secret in `STRIPE_WEBHOOK_SECRET`, or Adyen's standard webhook with
 * its HMAC key in `ADYEN_HMAC_KEY`, whichever `config.payment.driver` names.
 * Payments and refunds then reach their orders without app code; orders used
 * to sit at PENDING whenever the webhook was the only news of a payment.
 *
 * Unconfigured, it answers 401 and applies nothing. CSRF-exempt, since the
 * provider calls it; the signature is what authenticates it. An app route at
 * the same path registers first and wins.
 */
route.post('/webhooks/payments', request => orders.receivePaymentWebhook(request)).skipCsrf()
