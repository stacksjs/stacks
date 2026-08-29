# Good and bad tests

## Good

**Integration-style**: through real interfaces, not mocks of internal parts.

```typescript
import { describe, expect, test } from 'bun:test'

test('a customer can check out with a valid cart', async () => {
  const cart = await Cart.create({ customer_id: customer.id })
  await cart.add(product)

  const result = await checkout(cart, paymentMethod)

  expect(result.status).toBe('confirmed')
})
```

Characteristics:

- Tests behaviour callers care about.
- Uses the public surface only.
- Survives internal refactors.
- Describes what, not how.
- One logical assertion per test.

## Bad

**Implementation-detail tests**: coupled to internal structure.

```typescript
// bad: asserts on an internal collaborator
test('checkout calls the payment driver', async () => {
  const spy = mock(paymentDriver.process)
  await checkout(cart, payment)
  expect(spy).toHaveBeenCalledWith(cart.total)
})
```

Red flags: mocking internal collaborators, testing private methods, asserting on
call counts or ordering, a test that breaks on a refactor with no behaviour
change, a test name that describes how.

```typescript
// bad: bypasses the interface to verify
test('createUser saves to the database', async () => {
  await createUser({ name: 'Alice' })
  const row = await db.raw('select * from users where name = ?', ['Alice'])
  expect(row).toBeDefined()
})

// good: verifies through the interface
test('createUser makes the user retrievable', async () => {
  const user = await createUser({ name: 'Alice' })
  const retrieved = await User.find(user.id)
  expect(retrieved?.name).toBe('Alice')
})
```

**Tautological tests**: the expected value restates the implementation, so the
test passes by construction.

```typescript
// bad: expected value recomputed the way the code computes it
test('calculateTotal sums line items', () => {
  const items = [{ price: 10 }, { price: 5 }]
  const expected = items.reduce((sum, i) => sum + i.price, 0)
  expect(calculateTotal(items)).toBe(expected)
})

// good: expected value is an independent literal
test('calculateTotal sums line items', () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15)
})
```

## When to stand something in

Stand in at **system boundaries** only:

- Third-party HTTP: Stripe, SES, SendGrid, Mailgun, Twilio, Anthropic, OpenAI,
  Meilisearch, Algolia, Route53.
- Time and randomness.
- The queue, when the assertion is "this job was dispatched" rather than "this
  job ran".
- The filesystem, sometimes. The local storage driver is usually enough.

Do not stand in for:

- Your own actions, models, jobs or listeners.
- The database. Use `setupDatabase()` and `refreshDatabase()`.
- The cache. Use the `memory` driver.
- Anything under `@stacksjs/*` that you control.

## Designing for a stand-in

**Accept the dependency.**

```typescript
// easy to substitute
export async function processPayment(order: Order, gateway: PaymentGateway) {
  return gateway.charge(order.total)
}

// hard to substitute
export async function processPayment(order: Order) {
  const gateway = new StripeGateway(env.STRIPE_KEY)
  return gateway.charge(order.total)
}
```

**Prefer an SDK-shaped surface over one generic fetcher.** A named function per
external operation is independently substitutable and self-documenting. One
`fetch(endpoint, options)` forces conditional logic into every stand-in. This is
the shape the framework's own driver packages use, so a new external integration
should copy it rather than invent a third pattern.

## Queue assertions

```typescript
import { fake, restore } from '@stacksjs/queue'

test('publishing an article dispatches the index job', async () => {
  const queue = fake()

  await publishArticle(article.id)

  queue.assertDispatched('IndexArticle')
  restore()
})
```

`fake()` mutates global state, so `restore()` belongs in the same test or in
`afterEach`. A suite that forgets it will fail somewhere else and blame the wrong
code.
