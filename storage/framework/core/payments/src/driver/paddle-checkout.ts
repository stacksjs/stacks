import type { PaymentDriver } from './types'
import { PaddleDriver } from './paddle'
import { PaymentProviderError } from './types'

/**
 * The page a Paddle payment link opens (stacksjs/stacks#665).
 *
 * Paddle has no hosted checkout page: a transaction's payment link is the
 * default payment link set in Paddle - a page of yours that loads Paddle.js -
 * with `?_ptxn=<transaction>` appended, and Paddle.js opens the checkout for
 * it. The success page is a Paddle.js setting, not a transaction one, so this
 * page reads the one `checkout()` stored on the transaction and hands it to
 * Paddle.js. Set the default payment link in Paddle to
 * `https://<your app>/payments/checkout`.
 *
 * No inline script: the settings travel as JSON in a non-executing block and
 * the bootstrap is a same-origin script, so the page works under an app's
 * Content-Security-Policy that allows `self` and Paddle's CDN.
 */

export const PADDLE_JS_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js'
export const PADDLE_CHECKOUT_SCRIPT_PATH = '/payments/checkout.js'

const TRANSACTION_ID = /^txn_[a-z\d]{26}$/

/** Reads the settings block, then lets Paddle.js open the `_ptxn` checkout. */
export const PADDLE_CHECKOUT_SCRIPT = `(function () {
  var block = document.getElementById('stacks-paddle-checkout')
  if (!block || !window.Paddle) return
  var settings = JSON.parse(block.textContent || '{}')
  if (settings.environment === 'sandbox') window.Paddle.Environment.set('sandbox')
  var checkout = { displayMode: 'overlay' }
  if (settings.successUrl) checkout.successUrl = settings.successUrl
  window.Paddle.Initialize({ token: settings.token, checkout: { settings: checkout } })
})()
`

/** JSON safe inside a `<script>` element: no `</script>` can end it early. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

/** The checkout page for one transaction. */
export function paddleCheckoutPage(settings: { environment: 'sandbox' | 'live', token: string, successUrl: string | null }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Checkout</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#4b5563}</style>
</head>
<body>
<p>Opening checkout...</p>
<noscript><p>Checkout needs JavaScript. Turn it on and reload this page.</p></noscript>
<script id="stacks-paddle-checkout" type="application/json">${scriptJson(settings)}</script>
<script src="${PADDLE_JS_URL}"></script>
<script src="${PADDLE_CHECKOUT_SCRIPT_PATH}"></script>
</body>
</html>
`
}

function text(status: number, message: string): Response {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}

/**
 * `GET /payments/checkout?_ptxn=txn_...`. `driver` defaults to the
 * configured one; tests pass their own.
 */
export async function servePaddleCheckout(request: Request, driver?: PaymentDriver): Promise<Response> {
  let payments = driver
  if (!payments) {
    const { paymentDriver } = await import('./index')
    payments = paymentDriver()
  }
  if (!(payments instanceof PaddleDriver))
    return text(404, 'Not found.')
  const token = payments.clientToken
  if (!token)
    return text(503, 'Checkout is not set up: set PADDLE_CLIENT_TOKEN, a client-side token from Paddle.')

  const transactionId = new URL(request.url).searchParams.get('_ptxn') ?? ''
  if (!TRANSACTION_ID.test(transactionId))
    return text(400, 'This link does not name a checkout.')

  let successUrl: string | null
  try {
    successUrl = await payments.checkoutSuccessUrl(transactionId)
  }
  catch (error) {
    if (error instanceof PaymentProviderError)
      return text(error.status === 404 ? 404 : 502, error.status === 404 ? 'This checkout does not exist.' : 'Checkout is unavailable right now. Try again in a moment.')
    if (error instanceof TypeError)
      return text(400, 'This checkout cannot be opened here.')
    throw error
  }

  return new Response(paddleCheckoutPage({ environment: payments.environment, token, successUrl }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/** `GET /payments/checkout.js`. */
export function servePaddleCheckoutScript(): Response {
  return new Response(PADDLE_CHECKOUT_SCRIPT, {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
