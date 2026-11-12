import { licensing, orders } from '@stacksjs/commerce'
import { route } from '@stacksjs/router'
import { sendLicenseEmail } from '../app/Mail/LicenseEmail'

/**
 * The payment provider's webhook (stacksjs/stacks#665, #1879 Co-17).
 *
 * Point the provider at `POST /webhooks/payments`: Stripe's endpoint with its
 * signing secret in `STRIPE_WEBHOOK_SECRET`, or Adyen's standard webhook with
 * its HMAC key in `ADYEN_HMAC_KEY`, a Paddle notification destination with its
 * secret key in `PADDLE_WEBHOOK_SECRET`, or a Lemon Squeezy store webhook with
 * its signing secret in `LEMONSQUEEZY_WEBHOOK_SECRET`, whichever
 * `config.payment.driver` names.
 * Payments and refunds then reach their orders without app code; orders used
 * to sit at PENDING whenever the webhook was the only news of a payment.
 *
 * A paid checkout started with `licensing.licensePurchaseReference()` as its
 * `reference` is issued a license here too, once, and emailed its key; a
 * refund of that payment revokes it (`@stacksjs/commerce` `licensing`).
 *
 * Unconfigured, it answers 401 and applies nothing. CSRF-exempt, since the
 * provider calls it; the signature is what authenticates it. An app route at
 * the same path registers first and wins.
 */
// An app that set its own `onIssued` keeps it; this is only the fallback.
licensing.registerDefaultLicenseMailer(sendLicenseEmail)

route.post('/webhooks/payments', request => orders.receivePaymentWebhook(request)).skipCsrf()
