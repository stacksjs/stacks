/**
 * Which release the vendored framework defaults came from.
 *
 * `storage/framework/defaults` is the copy the generated auto-import barrel
 * reaches into, and `buddy upgrade` is the only thing that writes it. Bumping
 * `stacks` in package.json and running `bun install`, which is how anyone moves
 * a dependency, advances `node_modules/@stacksjs/defaults` and leaves the
 * vendored tree exactly where it was.
 *
 * These pin the four states, because `frameworkDefaultsDir` changes which copy
 * boot resolves based on them. Getting `not-applicable` wrong in particular
 * would make framework development resolve to the last build output instead of
 * live source.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULTS_SYNC_MARKER, defaultsPackagePath, inspectDefaultsProvenance, installedDefaultsVersion } from '../src/index'

let root: string

function write(relativePath: string, contents: string): void {
  const full = join(root, relativePath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
}

/** An app that installed the package and has a vendored tree stamped from it. */
function scaffold(options: { installed: string, stamped?: string }): void {
  write('node_modules/@stacksjs/defaults/package.json', JSON.stringify({ name: '@stacksjs/defaults', version: options.installed }))
  write('storage/framework/defaults/functions/billing.ts', 'export function useBillable() {}\n')

  if (options.stamped) {
    write(
      `storage/framework/defaults/${DEFAULTS_SYNC_MARKER}`,
      JSON.stringify({ version: options.stamped, syncedAt: '2026-08-11T00:00:00.000Z' }),
    )
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-defaults-provenance-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('framework defaults provenance', () => {
  it('reports a tree stamped from the installed version as current', () => {
    scaffold({ installed: '0.70.362', stamped: '0.70.362' })

    expect(inspectDefaultsProvenance(root)).toEqual({
      status: 'current',
      installed: '0.70.362',
      vendored: '0.70.362',
      syncedAt: '2026-08-11T00:00:00.000Z',
    })
  })

  it('reports a tree left behind by a plain dependency bump as stale', () => {
    scaffold({ installed: '0.70.362', stamped: '0.70.52' })

    expect(inspectDefaultsProvenance(root)).toMatchObject({
      status: 'stale',
      installed: '0.70.362',
      vendored: '0.70.52',
    })
  })

  it('reports a tree written before stamping existed as unstamped', () => {
    scaffold({ installed: '0.70.362' })

    expect(inspectDefaultsProvenance(root)).toMatchObject({
      status: 'unstamped',
      installed: '0.70.362',
      vendored: null,
    })
  })

  it('treats an unreadable marker as unstamped rather than throwing', () => {
    scaffold({ installed: '0.70.362' })
    write(`storage/framework/defaults/${DEFAULTS_SYNC_MARKER}`, 'not json at all')

    expect(inspectDefaultsProvenance(root).status).toBe('unstamped')
  })

  it('has nothing to compare without an installed package', () => {
    write('storage/framework/defaults/functions/billing.ts', 'export function useBillable() {}\n')

    expect(inspectDefaultsProvenance(root).status).toBe('not-applicable')
    expect(installedDefaultsVersion(root)).toBeNull()
  })

  it('has nothing to compare without a vendored tree', () => {
    write('node_modules/@stacksjs/defaults/package.json', '{"name":"@stacksjs/defaults","version":"0.70.362"}')

    expect(inspectDefaultsProvenance(root).status).toBe('not-applicable')
  })

  it('stays quiet in a framework checkout, where the tree is the source', () => {
    // The package there is a publish wrapper built *from* the vendored tree, so
    // any difference between them is a stale build, not a stale app. Preferring
    // the package would make every edit under defaults/ invisible until rebuild.
    scaffold({ installed: '0.70.400', stamped: '0.70.52' })
    write('storage/framework/core/buddy/package.json', '{"name":"@stacksjs/buddy"}')

    expect(inspectDefaultsProvenance(root).status).toBe('not-applicable')
  })

  it('stays quiet behind a link that resolves out of node_modules', () => {
    scaffold({ installed: '0.70.400', stamped: '0.70.52' })

    const elsewhere = mkdtempSync(join(tmpdir(), 'stacks-linked-defaults-'))
    writeFileSync(join(elsewhere, 'package.json'), '{"name":"@stacksjs/defaults","version":"0.70.400"}')
    rmSync(defaultsPackagePath(root), { recursive: true, force: true })
    require('node:fs').symlinkSync(elsewhere, defaultsPackagePath(root))

    expect(inspectDefaultsProvenance(root).status).toBe('not-applicable')
    rmSync(elsewhere, { recursive: true, force: true })
  })

  it('reads the installed version straight off the package', () => {
    scaffold({ installed: '0.70.362', stamped: '0.70.362' })

    expect(installedDefaultsVersion(root)).toBe('0.70.362')
    expect(defaultsPackagePath(root)).toBe(join(root, 'node_modules/@stacksjs/defaults'))
  })
})
