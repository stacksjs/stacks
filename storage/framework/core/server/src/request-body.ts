/** The HTTP listener's ceiling, separate from each action's file validation. */
export function serverRequestBodyOptions(value: unknown): { maxRequestBodySize?: number } {
  if (value === undefined)
    return {}
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0)
    throw new RangeError('server.maxRequestBodySize must be a positive safe integer of bytes')
  return { maxRequestBodySize: value }
}
