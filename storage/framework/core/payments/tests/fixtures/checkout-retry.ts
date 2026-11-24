import type { CheckoutRequest, Stripe } from '../../src'
import assert from 'node:assert/strict'
import { overridesReady } from '@stacksjs/config/overrides'
import { Payment, stripe } from '../../src'

await overridesReady

const sessions = new Map<string, { id: string, url: string }>()
const attempts: Array<{ key: string, body: string }> = []
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/v1/customers/cus_fixture') {
      return Response.json({ id: 'cus_fixture', object: 'customer', email: 'payer@example.test' })
    }
    if (path !== '/v1/checkout/sessions' || request.method !== 'POST') {
      return Response.json({ error: { type: 'invalid_request_error', message: 'Unexpected Stripe API request' } }, { status: 404 })
    }
    const key = request.headers.get('Idempotency-Key')
    assert(key)
    const body = await request.text()
    attempts.push({ key, body })
    const existing = sessions.get(key)
    if (existing)
      return Response.json(existing)
    const id = `cs_test_${sessions.size + 1}`
    const session = { id, url: `https://checkout.stripe.com/c/pay/${id}` }
    sessions.set(key, session)
    return Response.json(session)
  },
})

try {
  // Point the package's real Stripe SDK at the fixture in this isolated process.
  const sdk = (stripe.checkout.sessions as unknown as { _stripe: Stripe })._stripe
  sdk._setApiField('host', '127.0.0.1')
  sdk._setApiField('port', server.port)
  sdk._setApiField('protocol', 'http')

  const payer = { id: 42, stripe_id: 'cus_fixture' }
  const request: CheckoutRequest = {
    mode: 'subscription',
    lines: [{ price: 'price_monthly', quantity: 3 }],
    successUrl: 'https://app.example.test/account',
    cancelUrl: 'https://app.example.test/plans',
    reference: 'mailbox-checkout-42',
    metadata: { account_id: '42' },
    automaticTax: true,
    allowPromotionCodes: true,
    idempotencyKey: 'billing-attempt-41280bc4-f6ae-4611-a1d9-e9e96fba2e30',
  }
  const session = await Payment.checkout(payer, request)
  const retry = await Payment.checkout(payer, request)
  assert.equal(retry.id, session.id)
  assert.equal(attempts.length, 2)
  const { idempotencyKey, ...newAttempt } = request
  assert.equal(attempts[0]?.key, idempotencyKey)
  assert.deepEqual(attempts[1], attempts[0])
  const form = new URLSearchParams(attempts[0]?.body)
  assert.equal(form.get('line_items[0][price]'), 'price_monthly')
  assert.equal(form.get('line_items[0][quantity]'), '3')
  assert.equal(form.get('subscription_data[metadata][account_id]'), '42')
  assert.equal(form.get('allow_promotion_codes'), 'true')
  assert.equal(form.get('automatic_tax[enabled]'), 'true')
  assert.equal(form.has('idempotencyKey'), false)

  assert.notEqual((await Payment.checkout(payer, newAttempt)).id, (await Payment.checkout(payer, newAttempt)).id)
  assert.equal(sessions.size, 3)
  await assert.rejects(Payment.checkout(payer, { ...request, idempotencyKey: '' }), /nonblank/)
  await assert.rejects(Payment.checkout(payer, { ...request, idempotencyKey: 'x'.repeat(256) }), /at most 255/)
  assert.equal(attempts.length, 4)
}
finally {
  await server.stop(true)
}
