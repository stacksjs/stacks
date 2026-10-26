import { describe, expect, it } from 'bun:test'
import { claimUniqueValues } from '../src/seeder'

/**
 * How a seeded collision on a unique column is disambiguated
 * (stacksjs/stacks#2893).
 *
 * The seeder regenerates a colliding value three times and then appends a
 * suffix, which is what stops a factory with a small pool from failing a whole
 * model. The suffix was joined with a space, and a space is invalid in nearly
 * everything a unique string column is used for: a URL segment, a path
 * segment, a slug, a DNS label, an email local part, a package name, a git ref.
 *
 * Reported from a git forge where `handle` is unique on both `User` and
 * `Organization` and is the first segment of every owner's URL and the first
 * directory of every repository they own. After `buddy seed`, all four
 * organizations held a handle with a space in it, so not one of them could own
 * a repository: `storage/repos/globalsoft-ltd 1/x.git` is not a path anyone
 * can create. Nothing errored, and the rows looked plausible.
 */

/** Claim `value` twice, returning what the second row ended up with. */
function collide(value: unknown, suffix = 2): unknown {
  const used = new Map<string, Set<unknown>>()
  claimUniqueValues({ handle: value }, ['handle'], used, 1)

  const second: Record<string, unknown> = { handle: value }
  claimUniqueValues(second, ['handle'], used, suffix)
  return second.handle
}

describe('a disambiguated unique value', () => {
  it('stays usable as a path, a slug and a DNS label', () => {
    expect(collide('globalsoft-ltd')).toBe('globalsoft-ltd-2')
    expect(collide('helenjames')).toBe('helenjames-2')
    expect(collide('quinn962', 7)).toBe('quinn962-7')
  })

  it('keeps a number numeric, rather than making it a string', () => {
    // `value + suffix` on a number, which is how a unique integer column keeps
    // its type and its index.
    expect(collide(41)).toBe(43)
  })

  it('separates prose with a space, which is what reads best there', () => {
    /*
     * The column's grammar is the application's business, so the test is what
     * the value already is. One that holds a space is prose: a space reads
     * best and cannot make it any less legal than it already is.
     */
    expect(collide('Acme Corporation')).toBe('Acme Corporation 2')
    expect(collide('Helen James', 3)).toBe('Helen James 3')
  })

  it('keeps an email addressable, which a space would not', () => {
    // Listed in the issue among the things a space breaks, and it has no space
    // of its own, so it takes the hyphen too.
    // The suffix goes in the local part: after the domain it made the domain
    // `example.com-2`, which no mail reaches either.
    expect(collide('tiny.email+tag@example.com')).toBe('tiny.email+tag-2@example.com')
  })

  it('does not disambiguate at all until the retries are spent', () => {
    // suffix 0 is the regeneration pass: it reports the collision and leaves
    // the value for the caller to regenerate.
    const used = new Map<string, Set<unknown>>()
    expect(claimUniqueValues({ handle: 'acme' }, ['handle'], used, 0)).toBe(true)

    const second: Record<string, unknown> = { handle: 'acme' }
    expect(claimUniqueValues(second, ['handle'], used, 0)).toBe(false)
    expect(second.handle).toBe('acme')
  })

  it('never touches a null, which a unique index allows repeatedly', () => {
    const used = new Map<string, Set<unknown>>()
    const row: Record<string, unknown> = { handle: null }
    expect(claimUniqueValues(row, ['handle'], used, 1)).toBe(true)
    expect(claimUniqueValues(row, ['handle'], used, 2)).toBe(true)
    expect(row.handle).toBeNull()
  })
})
