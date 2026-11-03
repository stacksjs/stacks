export interface RetryOptions {
  retries?: number
  initialDelay?: number
  backoffFactor?: number
  jitter?: boolean
}

const MAX_TIMER_DELAY = 2147483647

function validateTiming(initialDelay: number, backoffFactor: number): void {
  if (!Number.isFinite(initialDelay) || initialDelay < 0 || !Number.isFinite(backoffFactor) || backoffFactor < 0)
    throw new RangeError('Retry delays and backoff factors must be finite non-negative numbers')
}

/** Run once, then at most `retries` more times. Invalid options reject before work starts. */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, initialDelay = 1000, backoffFactor = 2, jitter = true } = options
  if (!Number.isSafeInteger(retries) || retries < 0)
    throw new RangeError('Retries must be a non-negative safe integer')
  validateTiming(initialDelay, backoffFactor)
  for (let attempt = 0; ; attempt++) {
    try { return await fn() }
    catch (error) {
      if (attempt >= retries) throw error
      await new Promise<void>(resolve => setTimeout(resolve, calculateDelay(attempt, initialDelay, backoffFactor, jitter)))
    }
  }
}

/** Saturate at the platform timer limit instead of overflowing to a one-ms timeout. */
export function calculateDelay(attemptCount: number, initialDelay: number, backoffFactor: number, jitter?: boolean): number {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 0)
    throw new RangeError('Retry attempts must be non-negative safe integers')
  validateTiming(initialDelay, backoffFactor)
  let delay = initialDelay === 0 ? 0 : initialDelay * backoffFactor ** attemptCount
  if (!Number.isFinite(delay) || (delay === 0 && initialDelay > 0 && backoffFactor > 0)) {
    // The power alone may overflow/underflow even when the combined product is representable.
    delay = Math.exp(Math.log(initialDelay) + attemptCount * Math.log(backoffFactor))
  }
  // Multiplying by a bounded positive factor also handles exponential Infinity;
  // the previous Infinity + (-Infinity) jitter path produced NaN.
  const adjusted = delay * (jitter ? 0.7 + Math.random() * 0.6 : 1)
  return Math.min(MAX_TIMER_DELAY, adjusted)
}
