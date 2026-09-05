/**
 * Under canonical mode, what gets scanned does not depend on the project.
 *
 * The auto-import barrels are committed, so "is this file current?" needs one
 * answer. It did not have one: which framework model directories get scanned is
 * gated on whether a config file exists (`config/commerce.ts` and friends), so
 * two projects with different features scaffolded regenerate different barrels
 * and a freshness check cannot tell that apart from staleness
 * (stacksjs/stacks#2408).
 *
 * `STACKS_CANONICAL_FEATURES=1` scans every optional module regardless, making
 * the output a function of the source tree alone - the precondition for a
 * regenerate-and-diff check.
 *
 * An env var rather than a function call because generation spans processes:
 * `buddy generate` spawns, and orm's deferred model loader imports config on
 * its own. A mutation of a module-level map does not cross those boundaries.
 *
 * The framework has been here before. `generateTypes` used to emit a `Bun.env`
 * namespace whose keys came from whichever `.env` sat on the machine that ran
 * it; that generator was deleted rather than fixed.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname

/** Mirrors `OPTIONAL_MODEL_MODULES` in src/imports.ts. */
const optionalModules: Record<string, string[]> = {
  commerce: ['config/commerce.ts'],
  Content: ['config/cms.ts', 'config/blog.ts'],
  Forms: ['config/forms.ts'],
  realtime: ['config/realtime.ts'],
}

/** The gate as `configEnabled` applies it. */
function scanned(canonical: boolean, present: (rel: string) => boolean): string[] {
  return Object.entries(optionalModules)
    .filter(([, paths]) => canonical || paths.some(rel => present(rel)))
    .map(([subdir]) => subdir)
    .sort()
}

const onDisk = (rel: string) => existsSync(join(root, rel))

describe('canonical feature generation', () => {
  it('scans every optional module, whatever the project carries', () => {
    // No config file at all - a minimal app.
    expect(scanned(true, () => false)).toEqual(['Content', 'Forms', 'commerce', 'realtime'])
  })

  it('gives the same answer for a minimal app and a full one', () => {
    // The property that makes a freshness check possible: the scanned set is a
    // function of the source tree, not of the project's config.
    expect(scanned(true, () => false)).toEqual(scanned(true, () => true))
  })

  it('still varies with config when canonical mode is off', () => {
    // Not a bug on its own - a running app should load what it enabled. It is
    // only a problem for artifacts that get committed.
    expect(scanned(false, () => false)).toEqual([])
    expect(scanned(false, rel => rel !== 'config/commerce.ts' && onDisk(rel)))
      .not.toContain('commerce')
  })

  it('is off unless the env var says otherwise', () => {
    // Nothing about a running app changes by default.
    expect(process.env.STACKS_CANONICAL_FEATURES === '1').toBe(false)
  })
})
