import { PaymentProviderError, PaymentUnsupportedError } from '@stacksjs/payments'
import { response } from '@stacksjs/router'

/**
 * What the billing endpoints answer when a payment call fails in a way the
 * caller can act on, so every endpoint reports it the same way:
 *
 * - the configured provider cannot do it: 501, naming the provider;
 * - the provider refused it: 502, with the provider's message and code;
 * - the request itself was wrong (a float amount, a URL off this origin): 422.
 *
 * Anything else is a bug and is rethrown to the error handler.
 */
export function paymentFailure(error: unknown): Response {
  if (error instanceof PaymentUnsupportedError)
    return response.json({ message: error.message, driver: error.driver, operation: error.operation }, 501)
  if (error instanceof PaymentProviderError)
    return response.json({ message: error.message, driver: error.driver, code: error.code }, 502)
  if (error instanceof TypeError)
    return response.json({ message: error.message }, 422)
  throw error
}

/**
 * A driver result as the browser should see it: without `raw`, the provider's
 * own object, which carries far more than the page needs - customer ids,
 * metadata, other parties' references.
 */
export function forBrowser<T>(value: T): T {
  if (Array.isArray(value))
    return value.map(entry => forBrowser(entry)) as T
  if (value && typeof value === 'object' && 'raw' in value) {
    const { raw: _raw, ...rest } = value as Record<string, unknown>
    return rest as T
  }
  return value
}

/**
 * A payment method reference from a request: a local `payment_methods` row id
 * (a number, or digits) or the provider's own id (`pm_...`). Converting every
 * value with `Number()` turned a provider id into NaN.
 */
export function paymentMethodReference(value: unknown): number | string | null {
  if (typeof value === 'number' && Number.isInteger(value))
    return value
  if (typeof value !== 'string' || !value)
    return null
  return /^\d+$/.test(value) ? Number(value) : value
}
