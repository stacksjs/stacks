/** Parse HTTP Retry-After into a non-negative delay; malformed values have no deadline. */
export function retryAfterMilliseconds(value: string | null | undefined, now = Date.now()): number | null {
  const text = value?.trim()
  if (!text || !Number.isFinite(now)) return null
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const milliseconds = Number(text) * 1000
    return Number.isFinite(milliseconds) && milliseconds <= Number.MAX_SAFE_INTEGER ? Math.ceil(milliseconds) : null
  }
  // Date.parse accepts bare numbers and partial dates which are not HTTP dates.
  if (!/^(?:[a-z]{3}, \d{2} [a-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT|[a-z]+, \d{2}-[a-z]{3}-\d{2} \d{2}:\d{2}:\d{2} GMT|[a-z]{3} [a-z]{3} [ \d]\d \d{2}:\d{2}:\d{2} \d{4})$/i.test(text)) return null
  const deadline = Date.parse(text)
  return Number.isFinite(deadline) ? Math.max(0, deadline - now) : null
}
