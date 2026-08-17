import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reconcileVendoredManifests, resolveManifestSpec } from '../src/upgrade/packages'

/**
 * An app that vendors part of the framework has manifests under
 * `storage/framework/**` declaring their own `@stacksjs/*` dependencies. The
 * upgrade used to read only the root package.json, so those drifted silently.
 *
 * The case that turns silent drift into a hard failure: an app that vendored
 * `storage/framework/core` referenced those packages with `workspace:*`. Delete
 * that directory to move onto published packages and every one of those
 * references resolves to nothing, so `bun install` fails outright and the app
 * cannot install until each is rewritten by hand.
 */

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-vendored-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeManifest(relativePath: string, pkg: unknown): string {
  const full = join(root, relativePath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, `${JSON.stringify(pkg, null, 2)}\n`)
  return full
}

function readManifest(relativePath: string): any {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf-8'))
}

describe('resolveManifestSpec', () => {
  it('rewrites a workspace reference, which resolves to nothing once core is gone', () => {
    expect(resolveManifestSpec('@stacksjs/utils', 'workspace:*', '0.70.193')).toBe('^0.70.193')
    expect(resolveManifestSpec('stacks', 'workspace:^', '0.70.193')).toBe('^0.70.193')
  })

  it('moves a stale version onto the target, keeping the range operator', () => {
    expect(resolveManifestSpec('@stacksjs/utils', '^0.70.100', '0.70.193')).toBe('^0.70.193')
    expect(resolveManifestSpec('@stacksjs/utils', '~0.70.100', '0.70.193')).toBe('~0.70.193')
    // An exact pin was chosen deliberately, so it stays exact.
    expect(resolveManifestSpec('@stacksjs/utils', '0.70.100', '0.70.193')).toBe('0.70.193')
  })

  it('leaves a dependency that is already on target alone', () => {
    expect(resolveManifestSpec('@stacksjs/utils', '^0.70.193', '0.70.193')).toBeNull()
  })

  it('ignores packages the framework does not version', () => {
    expect(resolveManifestSpec('typescript', '^5.0.0', '0.70.193')).toBeNull()
    expect(resolveManifestSpec('bun-plugin-stx', '^0.2.108', '0.70.193')).toBeNull()
  })

  it('never bumps an independently-versioned package to a framework version', () => {
    // The bug this pins: @stacksjs/bun-router publishes 0.0.x and rides no
    // framework release, but a vendored manifest declaring ^0.0.20 was
    // rewritten to ^0.72.4 - a version that does not exist - so the upgrade
    // finished by making the app uninstallable. Only the root manifest had
    // the guard (#2078); vendored manifests were rewritten blind.
    const context = {
      lockstep: new Set(['stacks', '@stacksjs/utils']),
      metaDeps: { '@stacksjs/utils': '^0.72.4', '@stacksjs/tlsx': '^0.13.0' },
    }

    expect(resolveManifestSpec('@stacksjs/bun-router', '^0.0.20', '0.72.4', context)).toBeNull()
    // Not even a workspace reference justifies inventing a version.
    expect(resolveManifestSpec('@stacksjs/bun-router', 'workspace:*', '0.72.4', context)).toBeNull()
  })

  it('gives an independently-versioned package the range the meta declares', () => {
    const context = {
      lockstep: new Set(['stacks', '@stacksjs/utils']),
      metaDeps: { '@stacksjs/utils': '^0.72.4', '@stacksjs/tlsx': '^0.13.0' },
    }

    // tlsx IS declared by the meta, so its correct spec is knowable.
    expect(resolveManifestSpec('@stacksjs/tlsx', 'workspace:*', '0.72.4', context)).toBe('^0.13.0')
    expect(resolveManifestSpec('@stacksjs/tlsx', '^0.12.0', '0.72.4', context)).toBe('^0.13.0')
    expect(resolveManifestSpec('@stacksjs/tlsx', '^0.13.0', '0.72.4', context)).toBeNull()
    // Lockstep packages still move to the framework version.
    expect(resolveManifestSpec('@stacksjs/utils', 'workspace:*', '0.72.4', context)).toBe('^0.72.4')
  })

  it('does not guess at a spec someone set deliberately', () => {
    // A git url, a local link, or a dist-tag was a choice; rewriting it to a
    // version would quietly undo that choice.
    expect(resolveManifestSpec('@stacksjs/utils', 'github:stacksjs/utils', '0.70.193')).toBeNull()
    expect(resolveManifestSpec('@stacksjs/utils', 'file:../utils', '0.70.193')).toBeNull()
    expect(resolveManifestSpec('@stacksjs/utils', 'canary', '0.70.193')).toBeNull()
  })
})

describe('reconcileVendoredManifests', () => {
  it('rewrites workspace references so the app can install again', () => {
    writeManifest('storage/framework/api/package.json', {
      name: '@stacksjs/api',
      dependencies: { '@stacksjs/utils': 'workspace:*', '@stacksjs/router': 'workspace:*' },
    })

    const changes = reconcileVendoredManifests(root, '0.70.193')

    expect(changes).toHaveLength(2)
    expect(readManifest('storage/framework/api/package.json').dependencies).toEqual({
      '@stacksjs/utils': '^0.70.193',
      '@stacksjs/router': '^0.70.193',
    })
  })

  it('reaches manifests nested several levels deep', () => {
    // These are the ones missed by a single-level glob.
    writeManifest('storage/framework/libs/components/web/package.json', {
      name: 'web',
      devDependencies: { stacks: 'workspace:*' },
    })

    const changes = reconcileVendoredManifests(root, '0.70.193')

    expect(changes).toHaveLength(1)
    expect(readManifest('storage/framework/libs/components/web/package.json').devDependencies.stacks).toBe('^0.70.193')
  })

  it('never edits installed or built trees', () => {
    writeManifest('storage/framework/api/node_modules/@stacksjs/utils/package.json', {
      name: '@stacksjs/utils',
      dependencies: { '@stacksjs/router': 'workspace:*' },
    })
    writeManifest('storage/framework/api/dist/package.json', {
      name: 'built',
      dependencies: { '@stacksjs/router': 'workspace:*' },
    })

    expect(reconcileVendoredManifests(root, '0.70.193')).toEqual([])
  })

  it('writes nothing on a dry run, but still reports what would change', () => {
    writeManifest('storage/framework/api/package.json', {
      name: '@stacksjs/api',
      dependencies: { '@stacksjs/utils': 'workspace:*' },
    })

    const changes = reconcileVendoredManifests(root, '0.70.193', { dryRun: true })

    expect(changes).toHaveLength(1)
    expect(readManifest('storage/framework/api/package.json').dependencies['@stacksjs/utils']).toBe('workspace:*')
  })

  it('leaves unrelated dependencies untouched', () => {
    writeManifest('storage/framework/api/package.json', {
      name: '@stacksjs/api',
      dependencies: { '@stacksjs/utils': 'workspace:*', 'typescript': '^5.0.0' },
    })

    reconcileVendoredManifests(root, '0.70.193')

    expect(readManifest('storage/framework/api/package.json').dependencies.typescript).toBe('^5.0.0')
  })

  it('reports the file so the change can be traced', () => {
    writeManifest('storage/framework/orm/package.json', {
      name: '@stacksjs/orm',
      dependencies: { '@stacksjs/database': 'workspace:*' },
    })

    const [change] = reconcileVendoredManifests(root, '0.70.193')

    expect(change!.file).toBe('storage/framework/orm/package.json')
    expect(change!.from).toBe('workspace:*')
    expect(change!.to).toBe('^0.70.193')
  })

  it('survives a malformed manifest rather than failing the upgrade', () => {
    mkdirSync(join(root, 'storage/framework/broken'), { recursive: true })
    writeFileSync(join(root, 'storage/framework/broken/package.json'), '{ not json')
    writeManifest('storage/framework/api/package.json', {
      name: '@stacksjs/api',
      dependencies: { '@stacksjs/utils': 'workspace:*' },
    })

    expect(reconcileVendoredManifests(root, '0.70.193')).toHaveLength(1)
  })

  it('does nothing when the app vendors no framework at all', () => {
    expect(reconcileVendoredManifests(root, '0.70.193')).toEqual([])
  })

  it('preserves formatting conventions of the file it rewrites', () => {
    writeManifest('storage/framework/api/package.json', {
      name: '@stacksjs/api',
      dependencies: { '@stacksjs/utils': 'workspace:*' },
    })

    reconcileVendoredManifests(root, '0.70.193')

    const raw = readFileSync(join(root, 'storage/framework/api/package.json'), 'utf-8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw).toContain('  "name"')
  })
})
