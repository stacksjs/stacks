/**
 * The counts AGENTS.md quotes are still roughly true.
 *
 * AGENTS.md is the first thing an agent reads here, and it quotes sizes as
 * fact: how many default actions there are, how many built-in models,
 * migrations, config files. An agent plans against those numbers - whether to
 * enumerate a directory or trust the list it was given - so a number that has
 * drifted is a wrong premise, not a cosmetic nit. `~44 typed config files` was
 * one; there are 52.
 *
 * **Deliberately a tolerance, not an equality.** Pinning an exact count makes
 * every new action fail this test, and the fix is to type in the new total -
 * busywork that catches nothing. The `@stacksjs/alias` suite already learned
 * that and settled on a lower bound for the same reason. A band catches the
 * failure that matters, a number nobody has revisited in a year, while staying
 * quiet for the ordinary growth it is supposed to tolerate.
 *
 * A claim written with `~` is approximate by construction, so it gets the same
 * band as the rest: the tilde says do not trust the last digit, not do not
 * trust the magnitude.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const root = new URL('../../../../../', import.meta.url).pathname
const doc = readFileSync(join(root, 'AGENTS.md'), 'utf-8')

/** How far a quoted count may sit from the real one before it is stale. */
const TOLERANCE = 0.1

function walk(dir: string, keep: (name: string) => boolean): number {
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) total += walk(full, keep)
    else if (keep(entry.name)) total += 1
  }
  return total
}

/** The number AGENTS.md quotes in the sentence matching `pattern`. */
function quoted(pattern: RegExp): number {
  // AGENTS.md is hard-wrapped, so a claim can straddle a line break. Collapse
  // whitespace before matching rather than writing `\s+` into every pattern.
  const match = doc.replace(/\s+/g, ' ').match(pattern)
  if (!match)
    throw new Error(`AGENTS.md no longer contains a claim matching ${pattern}. Update this test with the sentence that replaced it.`)
  return Number(match[1]!.replace(/,/g, ''))
}

const claims: Array<{ what: string, pattern: RegExp, actual: () => number }> = [
  {
    // "There are 634 default actions and 102 built-in models you can use or override."
    // Non-test files: the 80 `.test.ts` files beside them are not actions.
    what: 'default actions',
    pattern: /There are ([\d,]+) default actions/,
    actual: () => walk(
      join(root, 'storage/framework/defaults/app/Actions'),
      name => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    ),
  },
  {
    what: 'built-in models',
    pattern: /default actions and ([\d,]+) built-in models/,
    actual: () => walk(
      join(root, 'storage/framework/defaults/app/Models'),
      name => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    ),
  },
  {
    what: 'migrations',
    pattern: /and ([\d,]+) migrations ship for/,
    actual: () => readdirSync(join(root, 'database/migrations')).filter(f => f.endsWith('.sql')).length,
  },
  {
    what: 'typed config files',
    pattern: /~([\d,]+) typed config files/,
    actual: () => readdirSync(join(root, 'config')).filter(f => f.endsWith('.ts')).length,
  },
]

describe('the counts AGENTS.md quotes', () => {
  for (const claim of claims) {
    it(`is close to the real number of ${claim.what}`, () => {
      const said = quoted(claim.pattern)
      const real = claim.actual()
      const drift = Math.abs(said - real) / real

      // Compared against the real count only when the claim has gone stale, so
      // a failure reads `said: 44` against `said: 52` - the number to write in
      // the document. Asserting the drift alone reports that 0.18 exceeds 0.1
      // and leaves you to work out the rest.
      expect({ claim: claim.what, said })
        .toEqual({ claim: claim.what, said: drift > TOLERANCE ? real : said })
    })
  }

  it('reads the AGENTS.md that agents actually read', () => {
    // The copy under `storage/framework/defaults/ai/` is a different, much
    // shorter seed for scaffolded apps, and does not carry these claims. The
    // root file is the canonical one.
    expect(statSync(join(root, 'AGENTS.md')).size).toBeGreaterThan(10_000)
    expect(doc).toContain('Canonical guidance for AI coding agents')
  })
})
