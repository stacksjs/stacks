/**
 * The pure parts of the subpath-exports check (stacksjs/stacks#2322).
 *
 * The end-to-end run needs the registry, so what is pinned here is the logic
 * that decides pass or fail — including the exact shape that shipped broken:
 * a range whose floor publishes only `.` while the code imports a subpath.
 */

import { describe, expect, it } from 'bun:test'
import { exportsSubpath, lowestSatisfying, splitSubpathImport, resolveTarget } from './check-subpath-exports'

describe('splitSubpathImport', () => {
  it('splits an unscoped subpath import', () => {
    expect(splitSubpathImport('craft-native/mobile')).toEqual({ pkg: 'craft-native', subpath: './mobile' })
  })

  it('splits a scoped subpath import', () => {
    expect(splitSubpathImport('@stacksjs/stx/serve')).toEqual({ pkg: '@stacksjs/stx', subpath: './serve' })
  })

  it('keeps a nested subpath whole', () => {
    expect(splitSubpathImport('craft-native/api/mobile')).toEqual({ pkg: 'craft-native', subpath: './api/mobile' })
  })

  it('ignores a bare package name, which always resolves to "."', () => {
    expect(splitSubpathImport('craft-native')).toBeNull()
    expect(splitSubpathImport('@stacksjs/config')).toBeNull()
  })

  it('ignores relative, absolute, aliased and builtin specifiers', () => {
    expect(splitSubpathImport('./local/thing')).toBeNull()
    expect(splitSubpathImport('/abs/thing')).toBeNull()
    expect(splitSubpathImport('~/app/thing')).toBeNull()
    expect(splitSubpathImport('node:fs/promises')).toBeNull()
    expect(splitSubpathImport('bun:test')).toBeNull()
  })
})

describe('exportsSubpath', () => {
  const rootOnly = { '.': { import: './dist/index.js' } }
  const withSubpaths = { '.': './dist/index.js', './mobile': './dist/mobile.js', './ios': './dist/ios.js' }
  const wildcard = { '.': './dist/index.js', './*': './dist/*.js' }

  it('is the failure that shipped: root-only exports, subpath import', () => {
    expect(exportsSubpath(rootOnly, './mobile')).toBe(false)
  })

  it('accepts a declared subpath', () => {
    expect(exportsSubpath(withSubpaths, './mobile')).toBe(true)
    expect(exportsSubpath(withSubpaths, './android')).toBe(false)
  })

  it('counts a wildcard, which is how our own packages publish their dist', () => {
    expect(exportsSubpath(wildcard, './anything')).toBe(true)
    expect(exportsSubpath({ './api/*': './dist/api/*.js' }, './api/mobile')).toBe(true)
    expect(exportsSubpath({ './api/*': './dist/api/*.js' }, './mobile')).toBe(false)
  })

  it('treats a conditions-only exports object as publishing "." alone', () => {
    expect(exportsSubpath({ import: './dist/index.js', require: './dist/index.cjs' }, './mobile')).toBe(false)
    expect(exportsSubpath({ import: './dist/index.js' }, '.')).toBe(true)
  })

  it('reports nothing exported when the field is missing or not an object', () => {
    expect(exportsSubpath(undefined, './mobile')).toBe(false)
    expect(exportsSubpath(null, './mobile')).toBe(false)
    expect(exportsSubpath(['./mobile'], './mobile')).toBe(false)
  })
})

describe('lowestSatisfying', () => {
  const published = ['0.0.9', '0.0.55', '0.0.67', '0.0.72', '0.0.85', '0.0.10']

  it('takes the floor of an open range, not the newest match', () => {
    // This is the whole point: `>=0.0.55` promises 0.0.55 will work, and
    // 0.0.55 is what a frozen-lockfile install can resolve to.
    expect(lowestSatisfying(published, '>=0.0.55')).toBe('0.0.55')
  })

  it('orders by semver, not lexically', () => {
    expect(lowestSatisfying(published, '>=0.0.9')).toBe('0.0.9')
    expect(lowestSatisfying(['0.0.10', '0.0.9'], '>=0.0.9')).toBe('0.0.9')
  })

  it('treats a caret on 0.0.x as the exact pin it is', () => {
    expect(lowestSatisfying(published, '^0.0.67')).toBe('0.0.67')
    expect(lowestSatisfying(published, '^0.0.68')).toBeNull()
  })

  it('reports null when nothing published satisfies the range', () => {
    expect(lowestSatisfying(published, '>=1.0.0')).toBeNull()
  })
})

describe('resolveTarget', () => {
  it('picks the lowest published version a range admits', () => {
    expect(resolveTarget('^0.74.0', ['0.73.0', '0.74.1', '0.74.9'])).toEqual({
      source: 'published',
      version: '0.74.1',
    })
  })

  it('falls back to the sibling in this repo while its release is publishing', () => {
    // The bump commit has landed; npm still only has the previous release.
    expect(resolveTarget('^0.74.11', ['0.74.9', '0.74.10'], '0.74.11')).toEqual({
      source: 'releasing',
      version: '0.74.11',
    })
  })

  it('prefers a published version over the local one when both satisfy', () => {
    expect(resolveTarget('^0.74.0', ['0.74.9'], '0.74.11')).toEqual({
      source: 'published',
      version: '0.74.9',
    })
  })

  it('still reports a range no published or local version satisfies', () => {
    expect(resolveTarget('^99.0.0', ['0.74.9'], '0.74.11')).toBeNull()
  })

  it('reports an unsatisfiable range when there is no sibling at all', () => {
    expect(resolveTarget('^2.0.0', ['1.0.0'])).toBeNull()
  })
})
