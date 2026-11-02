export function toString(v: unknown): string {
  return Object.prototype.toString.call(v)
}

/**
 * Mask a portion of a string with a repeated character, Laravel-style
 * (stacksjs/stacks#314).
 *
 * Useful for redacting PII in logs (credit card middle, phone digits,
 * email local part) without losing the format. The mask character is
 * repeated for `length` characters starting at `index`; `length` defaults
 * to "all remaining characters from index to end of string."
 *
 * `index` is the character offset, not a byte offset. Negative `index`
 * counts from the end of the string (`-4` = "start four characters from
 * the end"). An out-of-range `index` returns the original string.
 *
 * Characters are code points, as Laravel's `mb_*` functions count them. This
 * used to count UTF-16 units, so masking from 1 in `😀abc` left half the emoji
 * behind, a lone surrogate no database or JSON encoder takes.
 *
 * @example
 * ```ts
 * mask('1234567890123456', '*', 4, 8)   // → '1234********3456'
 * mask('1234567890123456', '*', 4)      // → '1234************'
 * mask('1234567890123456', '*', -4, 4)  // → '123456789012****'
 * mask('hello@example.com', '*', 1, 4)  // → 'h****@example.com'
 * ```
 */
export function mask(value: string, character: string, index: number, length?: number): string {
  if (character === '') return value

  const chars = Array.from(value)
  const len = chars.length
  // Negative index counts from the end.
  const start = index < 0 ? Math.max(0, len + index) : index
  if (start >= len) return value

  // Default length: from start to end.
  const maskLen = length === undefined ? len - start : Math.max(0, length)
  if (maskLen === 0) return value

  const end = Math.min(len, start + maskLen)
  // Use only the first character of the mask string to keep length stable.
  const fill = (Array.from(character)[0] ?? '').repeat(end - start)

  return chars.slice(0, start).join('') + fill + chars.slice(end).join('')
}
