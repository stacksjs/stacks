import { describe, expect, it } from 'bun:test'
import {
  AdyenDriver,
  PADDLE_CHECKOUT_SCRIPT,
  PADDLE_JS_URL,
  PADDLE_SUCCESS_URL_KEY,
  PaddleDriver,
  paddleCheckoutPage,
  servePaddleCheckout,
  servePaddleCheckoutScript,
} from '../src/driver'

/**
 * The page a Paddle payment link opens. Paddle has no hosted checkout: the
 * link is the app's own page with `?_ptxn=<transaction>`, and Paddle.js opens
 * the checkout there. The page hands Paddle.js the success page `checkout()`
 * stored on the transaction.
 */

const TXN = 'txn_01hv8m0mnx3sj85e7gxc6kga03'

function paddle(reply: { status?: number, body?: unknown }, config: { clientToken?: string } = { clientToken: 'test_7d279f61a3499fed520f7cd8c08' }) {
  const fetch = (async () => Response.json(reply.body ?? {}, { status: reply.status ?? 200 })) as unknown as typeof globalThis.fetch
  return new PaddleDriver({
    apiKey: 'pdl_sdbx_apikey_test',
    environment: 'sandbox',
    appUrl: 'https://app.test',
    ...config,
  }, { fetch })
}

const visit = (query: string) => new Request(`https://app.test/payments/checkout${query}`)

function settingsOf(html: string): Record<string, unknown> {
  const json = /<script id="stacks-paddle-checkout" type="application\/json">(.*?)<\/script>/s.exec(html)?.[1]
  return JSON.parse(json ?? 'null')
}

describe('Paddle checkout page', () => {
  it('opens Paddle.js on the transaction, with the success page it was created with', async () => {
    const driver = paddle({ body: { data: { id: TXN, status: 'ready', custom_data: { [PADDLE_SUCCESS_URL_KEY]: 'https://app.test/done' } } } })
    const response = await servePaddleCheckout(visit(`?_ptxn=${TXN}`), driver)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const html = await response.text()
    expect(html).toContain(`<script src="${PADDLE_JS_URL}"></script>`)
    expect(html).toContain('<script src="/payments/checkout.js"></script>')
    expect(settingsOf(html)).toEqual({ environment: 'sandbox', token: 'test_7d279f61a3499fed520f7cd8c08', successUrl: 'https://app.test/done' })
  })

  it('opens a transaction Paddle made itself (a payment method update) with no success page', async () => {
    const driver = paddle({ body: { data: { id: TXN, status: 'ready', custom_data: null } } })
    const html = await (await servePaddleCheckout(visit(`?_ptxn=${TXN}`), driver)).text()
    expect(settingsOf(html)).toMatchObject({ successUrl: null })
  })

  it('cannot be broken out of by what it embeds', () => {
    const html = paddleCheckoutPage({ environment: 'live', token: 'live_x', successUrl: 'https://app.test/</script><script>alert(1)</script>' })
    expect(html).not.toContain('</script><script>alert(1)')
    expect(settingsOf(html)).toMatchObject({ successUrl: 'https://app.test/</script><script>alert(1)</script>' })
  })

  it('refuses a link that names no transaction, or not a Paddle one', async () => {
    const driver = paddle({ body: {} })
    expect((await servePaddleCheckout(visit(''), driver)).status).toBe(400)
    expect((await servePaddleCheckout(visit('?_ptxn=../customers'), driver)).status).toBe(400)
  })

  it('refuses a transaction whose success page is off the application\'s origin', async () => {
    const driver = paddle({ body: { data: { id: TXN, status: 'ready', custom_data: { [PADDLE_SUCCESS_URL_KEY]: 'https://evil.example/' } } } })
    expect((await servePaddleCheckout(visit(`?_ptxn=${TXN}`), driver)).status).toBe(400)
  })

  it('says what is wrong when Paddle does not know the transaction, or is down', async () => {
    const missing = paddle({ status: 404, body: { error: { code: 'not_found', detail: 'Entity not found' } } })
    expect((await servePaddleCheckout(visit(`?_ptxn=${TXN}`), missing)).status).toBe(404)
    const down = paddle({ status: 500, body: { error: { code: 'internal_error', detail: 'oops' } } })
    expect((await servePaddleCheckout(visit(`?_ptxn=${TXN}`), down)).status).toBe(502)
  })

  it('is set up only with a client-side token, and only under the Paddle driver', async () => {
    const tokenless = paddle({ body: {} }, {})
    const response = await servePaddleCheckout(visit(`?_ptxn=${TXN}`), tokenless)
    expect(response.status).toBe(503)
    expect(await response.text()).toContain('PADDLE_CLIENT_TOKEN')

    const adyen = new AdyenDriver({ apiKey: 'k', merchantAccount: 'm', environment: 'test' })
    expect((await servePaddleCheckout(visit(`?_ptxn=${TXN}`), adyen)).status).toBe(404)
  })

  it('serves its bootstrap as a same-origin script, so a CSP of self allows it', async () => {
    const response = servePaddleCheckoutScript()
    expect(response.headers.get('Content-Type')).toContain('text/javascript')
    expect(await response.text()).toBe(PADDLE_CHECKOUT_SCRIPT)
    expect(PADDLE_CHECKOUT_SCRIPT).toContain('Paddle.Initialize')
    expect(PADDLE_CHECKOUT_SCRIPT).toContain('Environment.set(\'sandbox\')')
  })

  it('runs the bootstrap against Paddle.js as the page loads it', () => {
    // Paddle.js stand-in: record what the bootstrap asks of it.
    const calls: unknown[] = []
    const window = { Paddle: { Environment: { set: (env: string) => calls.push(['environment', env]) }, Initialize: (options: unknown) => calls.push(['initialize', options]) } }
    const document = { getElementById: () => ({ textContent: JSON.stringify({ environment: 'sandbox', token: 'test_tok', successUrl: 'https://app.test/done' }) }) }
    new Function('window', 'document', PADDLE_CHECKOUT_SCRIPT)(window, document)
    expect(calls).toEqual([
      ['environment', 'sandbox'],
      ['initialize', { token: 'test_tok', checkout: { settings: { displayMode: 'overlay', successUrl: 'https://app.test/done' } } }],
    ])
  })
})
