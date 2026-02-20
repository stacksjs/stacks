export { DateTime, now } from './now'
export { format } from './format'
export { parse } from './parse'

/**
 * Format a date using a token-based format string.
 * This is a convenience alias for `format()`.
 *
 * @example
 * ```ts
 * dateFormat(new Date(), 'YYYY-MM-DD HH:mm:ss')
 * dateFormat('2024-03-15', 'MMMM D, YYYY')
 * ```
 */
export { format as dateFormat } from './format'
