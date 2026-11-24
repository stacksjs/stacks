/**
 * Count a post the way each network counts it.
 *
 * The drivers used to check every limit with `.length`, which counts UTF-16
 * units. No network counts that way, so a driver disagreed with the network
 * in both directions: a Bluesky post of 200 emoji, well within 300, was
 * refused before it was sent, and an X post in Japanese passed here and was
 * refused by X.
 *
 * No imports, so a composer in the browser can run the same code as the
 * server and show the same count.
 *
 * - Bluesky counts graphemes: one emoji, however it is built, is one.
 * - X counts a weighted length: most Latin text is one each, CJK and emoji
 *   are two, and a link is always 23 whatever its real length.
 * - Mastodon counts graphemes, a link as 23 (or what the instance says), and
 *   a mention without its server (`@name@example.social` counts as `@name`).
 * - Threads counts graphemes.
 * - LinkedIn and Instagram are counted in UTF-16 units. Their documentation
 *   gives a limit and no counting rule; UTF-16 is never smaller than the
 *   alternatives, so a post that passes here cannot be too long there.
 */

/** What X, and Mastodon by default, count a link as. */
export const LINK_LENGTH = 23

// A link as the networks find one: a scheme, or a bare domain with a common
// ending. Trailing punctuation belongs to the sentence, not the link, and a
// domain straight after an @ is the server of a mention, not a link.
const URL_PATTERN = /\bhttps?:\/\/[^\s<>]+|(?<![@\w.-])(?:[a-z0-9-]+\.)+(?:com|org|net|io|dev|app|co|social|blog|ai|me|info|xyz|tv|fm|us|uk|de|fr|jp|ca|au|nl|ch|se|no|es|it)\b(?:\/[^\s<>]*)?/gi
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/

let segmenter: Intl.Segmenter | undefined

function graphemeSegmenter(): Intl.Segmenter {
  segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  return segmenter
}

/** The number of user-perceived characters. */
export function graphemes(text: string): number {
  let count = 0
  // eslint-disable-next-line no-unused-vars
  for (const _ of graphemeSegmenter().segment(text)) count++
  return count
}

/** Split text into links and the text between them. */
function splitLinks(text: string): Array<{ link: boolean, value: string }> {
  const parts: Array<{ link: boolean, value: string }> = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const value = match[0].replace(TRAILING_PUNCTUATION, '')
    if (!value) continue
    const start = match.index
    if (start > last) parts.push({ link: false, value: text.slice(last, start) })
    parts.push({ link: true, value })
    last = start + value.length
  }
  if (last < text.length) parts.push({ link: false, value: text.slice(last) })
  return parts
}

/** X gives these ranges a weight of one; everything else counts double. */
function isLightForX(codePoint: number): boolean {
  return codePoint <= 0x10FF
    || (codePoint >= 0x2000 && codePoint <= 0x200D)
    || (codePoint >= 0x2010 && codePoint <= 0x201F)
    || (codePoint >= 0x2032 && codePoint <= 0x2037)
}

function weightedForX(text: string): number {
  let total = 0
  for (const { segment } of graphemeSegmenter().segment(text.normalize('NFC'))) {
    // An emoji is two however many code points build it.
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(segment)) {
      total += 2
      continue
    }
    for (const char of segment) total += isLightForX(char.codePointAt(0)!) ? 1 : 2
  }
  return total
}

export interface CountTextOptions {
  /** What a link counts as on Mastodon. An instance can change it; 23 by default. */
  linkLength?: number
}

/** The length `provider` would measure `text` at. */
export function countText(provider: string, text: string, options: CountTextOptions = {}): number {
  const value = String(text ?? '')
  switch (provider) {
    case 'twitter':
      return splitLinks(value).reduce((sum, part) => sum + (part.link ? LINK_LENGTH : weightedForX(part.value)), 0)
    case 'mastodon': {
      const linkLength = options.linkLength ?? LINK_LENGTH
      return splitLinks(value).reduce((sum, part) => {
        if (part.link) return sum + linkLength
        // The server part of a mention is not counted.
        return sum + graphemes(part.value.replace(/(^|[^\w/])(@[\w.-]+)@[\w.-]+\.[a-z]{2,}/gi, '$1$2'))
      }, 0)
    }
    case 'bluesky':
    case 'threads':
      return graphemes(value)
    default:
      return value.length
  }
}

/** Whether `text` is longer than `limit` on `provider`. A limit of 0 means none. */
export function exceedsLimit(provider: string, text: string, limit: number, options: CountTextOptions = {}): boolean {
  return limit > 0 && countText(provider, text, options) > limit
}
