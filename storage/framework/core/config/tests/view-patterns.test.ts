// Which views an app actually serves (stacksjs/stacks#2237).
//
// The dev views server and the production server both registered
// `[userViewsPath, defaultViewsPath]` with no config check, so every Stacks
// app served the scaffold's demo storefront as live public routes — /cart,
// /checkout/payment, /orders/:id — and enumerated them into its sitemap. A
// privacy-analytics SaaS answering /checkout is not a styling problem.
//
// The route registry already lets an app decide what to spread. `resolveViewPatterns`
// is the same lever for views, and it is shared by both servers rather than
// implemented twice: a views policy that dev and production disagree about is
// a defect you only discover in production.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveViewPatterns } from '../src/views'

const USER = 'resources/views'
const DEFAULTS = 'storage/framework/defaults/resources/views'

/** Stand-in for the defaults tree, so the tests do not depend on its contents. */
const PRESENT = new Set([
  join(DEFAULTS, 'errors'),
  join(DEFAULTS, 'emails'),
  join(DEFAULTS, 'dashboard'),
])
const exists = (path: string): boolean => PRESENT.has(path)

describe('default views stay on unless an app says otherwise (#2237)', () => {
  it('registers both when unset', () => {
    // The compatibility case, and the one that matters most: an app that says
    // nothing must behave exactly as it did before.
    expect(resolveViewPatterns(USER, DEFAULTS, undefined, exists).patterns)
      .toEqual([USER, DEFAULTS])
  })

  it('registers both when true', () => {
    expect(resolveViewPatterns(USER, DEFAULTS, true, exists).patterns)
      .toEqual([USER, DEFAULTS])
  })

  it('ignores a non-boolean, non-array value rather than serving nothing', () => {
    // A bad config value must not silently take the app's own views down with
    // it — falling back to the previous behaviour is the safe direction.
    expect(resolveViewPatterns(USER, DEFAULTS, 'yes' as any, exists).patterns)
      .toEqual([USER, DEFAULTS])
  })
})

describe('an app can opt out (#2237)', () => {
  it('false registers only the app views', () => {
    const { patterns, missing } = resolveViewPatterns(USER, DEFAULTS, false, exists)
    expect(patterns).toEqual([USER])
    expect(missing).toEqual([])
  })

  it('an array registers only the named subtrees', () => {
    expect(resolveViewPatterns(USER, DEFAULTS, ['errors', 'emails'], exists).patterns)
      .toEqual([USER, join(DEFAULTS, 'errors'), join(DEFAULTS, 'emails')])
  })

  it('the storefront is gone when it is not named', () => {
    // The concrete complaint: /cart and /checkout must not be reachable.
    const { patterns } = resolveViewPatterns(USER, DEFAULTS, ['errors'], exists)
    expect(patterns).not.toContain(DEFAULTS)
    expect(patterns.some(p => p.includes('checkout'))).toBeFalse()
  })

  it('an empty array is the same as false', () => {
    expect(resolveViewPatterns(USER, DEFAULTS, [], exists).patterns).toEqual([USER])
  })

  it('reports a name that does not exist instead of dropping it', () => {
    // Silently ignoring a typo is indistinguishable from the subtree being
    // turned off, so the caller gets something to warn about.
    const { patterns, missing } = resolveViewPatterns(USER, DEFAULTS, ['errors', 'typo'], exists)
    expect(patterns).toEqual([USER, join(DEFAULTS, 'errors')])
    expect(missing).toEqual(['typo'])
  })

  it('refuses to escape the defaults tree', () => {
    // `..` or a leading slash would register a directory the app never asked
    // for — including, with enough of them, the whole project.
    const { patterns } = resolveViewPatterns(USER, DEFAULTS, ['../../..', '/etc', ''], exists)
    expect(patterns).toEqual([USER])
  })
})

describe('both servers go through it (#2237)', () => {
  // Static assertions: a call site that composes its own array is how dev and
  // production drift apart, and the drift is invisible until deploy.
  const dev = readFileSync(join(import.meta.dir, '../../actions/src/dev/views.ts'), 'utf8')
  const prod = readFileSync(join(import.meta.dir, '../../buddy/src/production-server.ts'), 'utf8')

  it('the dev server resolves its patterns', () => {
    expect(dev).toContain('resolveViewPatterns(')
    expect(dev).toContain('patterns: viewPatterns.patterns')
  })

  it('the production server resolves its patterns', () => {
    expect(prod).toContain('resolveViewPatterns(')
    expect(prod).toContain('patterns: viewPatterns.patterns')
  })

  it('neither still hardcodes the pair', () => {
    expect(dev).not.toContain('patterns: [userViewsPath, defaultViewsPath]')
    expect(prod).not.toContain('patterns: [userViewsPath, defaultViewsPath]')
  })
})
