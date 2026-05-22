/**
 * Stripe idempotency-key helpers (stacksjs/stacks#1876 X-1).
 *
 * Background: Stripe API calls that create or attach resources
 * (customers, subscriptions, payment methods, payment intents) are
 * NOT idempotent by default — retrying after a network blip can
 * produce duplicate Stripe objects. The classic failure mode: a
 * caller invokes `manageCustomer.createStripeCustomer(user)`, Stripe
 * succeeds, then the follow-up `user.update({ stripe_id })` fails
 * (DB hiccup, validation error, anything). The next request sees
 * no `stripe_id`, calls `createStripeCustomer` again, and Stripe
 * dutifully creates a second customer. Now you have two customers
 * in Stripe with no link to the local user.
 *
 * Fix: every create / attach / update call passes an `idempotencyKey`
 * derived deterministically from the operation + user + version.
 * Stripe caches the response under that key for 24h — a retry with
 * the same key returns the original object instead of creating a
 * new one. Key construction:
 *
 *   `stacks:<scope>:<userId>:<extra...>:v1`
 *
 * The `v1` suffix is a schema-version bump knob — if we change
 * the operation's shape in a way that should NOT collide with a
 * cached response (different parameters, different intent), bump
 * the suffix and old retries get a fresh call.
 *
 * Stripe accepts idempotency keys up to 255 chars. We hash the
 * tail with SHA-256 if the constructed key would exceed that
 * bound — the hash is stable so the same input always produces
 * the same key.
 *
 * @example
 * ```ts
 * await stripe.customers.create(params, {
 *   idempotencyKey: stacksIdempotencyKey('customer.create', user.id),
 * })
 * ```
 */

import { createHash } from 'node:crypto'

const KEY_PREFIX = 'stacks'
const KEY_VERSION = 'v1'
const MAX_KEY_LENGTH = 255

/**
 * Build a deterministic Stripe idempotency key for an operation.
 * The `scope` should be a stable string identifying the call site
 * (e.g. `'customer.create'`, `'subscription.create'`); `parts` are
 * any extra identifying values (user id, lookup key, etc.) that
 * uniquely scope the operation within that user's lifetime.
 *
 * @param scope - stable operation name; never user input
 * @param parts - identifying values appended after scope (coerced
 *                to string; nullish values are skipped)
 */
export function stacksIdempotencyKey(scope: string, ...parts: Array<string | number | null | undefined>): string {
  const tail = parts
    .filter(p => p !== null && p !== undefined && p !== '')
    .map(p => String(p))
    .join(':')

  const raw = tail
    ? `${KEY_PREFIX}:${scope}:${tail}:${KEY_VERSION}`
    : `${KEY_PREFIX}:${scope}:${KEY_VERSION}`

  // Stripe caps idempotency keys at 255 chars. Anything longer gets
  // its tail collapsed to a stable SHA-256 prefix — same input still
  // produces the same key, so retries match.
  if (raw.length <= MAX_KEY_LENGTH) return raw

  const hashed = createHash('sha256').update(tail).digest('hex').slice(0, 32)
  return `${KEY_PREFIX}:${scope}:${hashed}:${KEY_VERSION}`
}

/**
 * Build a one-shot idempotency key for operations that are NOT
 * naturally retryable (a unique-per-attempt key that won't collide
 * with anything). Used when the caller WANTS a fresh Stripe object
 * each time but still wants the safety of a single network retry
 * within a single attempt. The key includes a random suffix so
 * sequential attempts produce different keys.
 *
 * Used for payment intents, checkout sessions — operations where
 * "create another one" is the right semantic on a retry by the
 * caller, but where a single network blip during a single attempt
 * still benefits from in-flight idempotency.
 */
export function freshIdempotencyKey(scope: string, ...parts: Array<string | number | null | undefined>): string {
  const random = createHash('sha256').update(`${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16)
  return stacksIdempotencyKey(scope, ...parts, random)
}
