/**
 * The attribute-to-column-name conversion, pinned.
 *
 * Three files each carried their own copy of `snakeCase`, and all three had a
 * rule the shared one in `@stacksjs/strings` does not:
 *
 *     .replace(/(\d)([A-Za-z])/g, '$1_$2')
 *
 * A digit followed by a *lowercase* letter is not a word boundary. `p256dh` is
 * one token - it is the name the Push API gives a subscription key - and that
 * rule turned it into `p256_dh`, a column nothing else in the framework
 * derives. The application's model said `p256dh`, the generated SQL said
 * `p256_dh`, and the query that read it back found nothing.
 *
 * The uppercase rule above it already handles the case anybody meant to catch:
 * `sha256Sum` has a real boundary and splits on it. So the extra rule could
 * only ever fire where there was no boundary at all.
 *
 * This test exists because the divergence is invisible: both spellings look
 * plausible, and the failure surfaces as an empty result rather than an error.
 */

import { describe, expect, it } from 'bun:test'
import { snakeCase } from '@stacksjs/strings'

/** The same conversion the schema and migration generators perform. */
function columnName(attribute: string): string {
  return attribute
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
}

describe('an attribute name becomes a column name', () => {
  it('splits on case, which is where the boundary is', () => {
    expect(columnName('userAgent')).toBe('user_agent')
    expect(columnName('lastSeenAt')).toBe('last_seen_at')
    expect(columnName('createdAt')).toBe('created_at')
  })

  it('does not split a digit from the letter after it', () => {
    // The defect this file was written for. Every one of these is a single
    // token in the specification it comes from.
    expect(columnName('p256dh')).toBe('p256dh')
    expect(columnName('utf8text')).toBe('utf8text')
    expect(columnName('base64url')).toBe('base64url')
    expect(columnName('oauth2')).toBe('oauth2')
  })

  it('still splits a digit from an uppercase letter, which is a boundary', () => {
    expect(columnName('sha256Sum')).toBe('sha256_sum')
    expect(columnName('base64Url')).toBe('base64_url')
  })

  it('handles an acronym run', () => {
    expect(columnName('HTTPSPort')).toBe('https_port')
    expect(columnName('userID')).toBe('user_id')
  })

  it('agrees with @stacksjs/strings, which is the whole point', () => {
    // The generators used to disagree with the shared helper, so the types and
    // the SQL could name the same column differently. Anything derived one way
    // and read the other silently found nothing.
    for (const name of ['p256dh', 'userAgent', 'lastSeenAt', 'sha256Sum', 'utf8text', 'HTTPSPort'])
      expect(columnName(name)).toBe(snakeCase(name))
  })
})
