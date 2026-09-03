/**
 * Which installed packages the framework discovers, and where it says they are.
 *
 * Discovery is Stacks' equivalent of Laravel's package auto-discovery, and it
 * had two properties that made it unusable for the thing it exists for.
 *
 * It scanned `pantry/` only. That is this repository's own package tree; an
 * application that runs `bun add loghq` gets `node_modules/loghq`, which the
 * scan never looked at. So a package could declare everything correctly and
 * still be invisible.
 *
 * And the manifest recorded no location, so the one consumer (the router)
 * hardcoded `pantry/<name>` to find a package's route files. Widening the scan
 * without recording the root would have produced manifests the router resolved
 * against the wrong directory, failing soft and silently, which is worse than
 * not finding the package at all.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverPackages } from '../src/discover-packages'

let project: string

/** Write a package.json into a tree, creating directories as needed. */
function pkg(relativeDir: string, contents: Record<string, unknown>): void {
  const dir = join(project, relativeDir)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(contents, null, 2))
}

/** The application's own package.json, which names its direct dependencies. */
function app(contents: Record<string, unknown>): void {
  writeFileSync(join(project, 'package.json'), JSON.stringify(contents, null, 2))
}

function discover() {
  return discoverPackages({ projectRoot: project, dryRun: true })
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'stacks-discovery-'))
})

afterEach(() => {
  rmSync(project, { recursive: true, force: true })
})

describe('package discovery', () => {
  test('finds a package the application installed, which is the whole point', async () => {
    app({ name: 'my-app', dependencies: { loghq: '^1.0.0' } })
    pkg('node_modules/loghq', {
      name: 'loghq',
      stacks: { name: 'loghq', routes: ['routes/logs.ts'], directories: ['app', 'database'] },
    })

    const manifest = await discover()

    expect(Object.keys(manifest.packages)).toEqual(['loghq'])
    expect(manifest.packages.loghq?.routes).toEqual(['routes/logs.ts'])
  })

  test('records where the package is, relative to the project', async () => {
    app({ name: 'my-app', dependencies: { loghq: '^1.0.0' } })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })

    const manifest = await discover()

    // Relative, because this manifest is committed: an absolute path would be
    // a machine-specific diff on every boot. And present at all, because the
    // router resolves a package's route files against it.
    expect(manifest.packages.loghq?.root).toBe(join('node_modules', 'loghq'))
  })

  test('finds a scoped package', async () => {
    app({ name: 'my-app', dependencies: { '@loghq/core': '^1.0.0' } })
    pkg('node_modules/@loghq/core', { name: '@loghq/core', stacks: { name: 'loghq-core' } })

    const manifest = await discover()

    expect(manifest.packages['@loghq/core']?.root).toBe(join('node_modules', '@loghq', 'core'))
  })

  test('ignores a package that declares no stacks key', async () => {
    app({ name: 'my-app', dependencies: { 'left-pad': '^1.0.0', loghq: '^1.0.0' } })
    pkg('node_modules/left-pad', { name: 'left-pad' })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })

    const manifest = await discover()

    expect(Object.keys(manifest.packages)).toEqual(['loghq'])
  })

  test('ignores a transitive dependency the application never named', async () => {
    // A package the app did not ask for has no business injecting models or
    // routes into it, and walking the whole tree would mean reading thousands
    // of manifests on every boot.
    app({ name: 'my-app', dependencies: { loghq: '^1.0.0' } })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })
    pkg('node_modules/some-transitive-dep', {
      name: 'some-transitive-dep',
      stacks: { name: 'sneaky', routes: ['routes/everything.ts'] },
    })

    const manifest = await discover()

    expect(Object.keys(manifest.packages)).toEqual(['loghq'])
  })

  test('honours the application opting a package out', async () => {
    app({
      name: 'my-app',
      dependencies: { loghq: '^1.0.0' },
      stacks: { 'dont-discover': ['loghq'] },
    })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })

    const manifest = await discover()

    expect(manifest.packages).toEqual({})
  })

  test('still scans the pantry tree', async () => {
    // The root discovery was originally written against. Globbed rather than
    // read from dependencies, because it is not always named in a package.json.
    app({ name: 'my-app' })
    pkg('pantry/table', { name: '@stacksjs/table', stacks: { name: 'table', directories: ['resources'] } })

    const manifest = await discover()

    expect(manifest.packages['@stacksjs/table']?.root).toBe(join('pantry', 'table'))
  })

  test('prefers node_modules over pantry, and says which copy it ignored', async () => {
    app({ name: 'my-app', dependencies: { loghq: '^1.0.0' } })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq', routes: ['routes/new.ts'] } })
    pkg('pantry/loghq', { name: 'loghq', stacks: { name: 'loghq', routes: ['routes/old.ts'] } })

    const manifest = await discover()

    expect(manifest.packages.loghq?.routes).toEqual(['routes/new.ts'])
    expect(manifest.packages.loghq?.root).toBe(join('node_modules', 'loghq'))
    // Reported rather than dropped: the two copies are frequently different
    // versions, and which one won is the first thing worth knowing.
    expect(manifest.shadowed).toEqual([
      { name: 'loghq', used: join('node_modules', 'loghq'), ignored: join('pantry', 'loghq') },
    ])
  })

  test('finds nothing in a project with no packages, and reports no shadowing', async () => {
    app({ name: 'my-app', dependencies: { 'left-pad': '^1.0.0' } })
    pkg('node_modules/left-pad', { name: 'left-pad' })

    const manifest = await discover()

    expect(manifest.packages).toEqual({})
    expect(manifest.shadowed).toBeUndefined()
  })

  test('survives a project with no package.json and no trees at all', async () => {
    // Discovery runs during early boot, where none of this is guaranteed.
    const manifest = await discover()

    expect(manifest.packages).toEqual({})
    expect(manifest.generated_at).toBeTruthy()
  })

  test('survives an unreadable package.json rather than aborting the scan', async () => {
    app({ name: 'my-app', dependencies: { broken: '^1.0.0', loghq: '^1.0.0' } })
    mkdirSync(join(project, 'node_modules/broken'), { recursive: true })
    writeFileSync(join(project, 'node_modules/broken/package.json'), '{ not json')
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })

    const manifest = await discover()

    expect(Object.keys(manifest.packages)).toEqual(['loghq'])
  })

  test('writes the manifest only when the discovered set changes', async () => {
    app({ name: 'my-app', dependencies: { loghq: '^1.0.0' } })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })
    const manifestPath = join(project, 'manifest.json')

    const first = await discoverPackages({ projectRoot: project, manifestPath })
    const second = await discoverPackages({ projectRoot: project, manifestPath })

    // `generated_at` moves on every run, so comparing whole manifests would
    // dirty a committed file on every boot.
    expect(second.generated_at).toBe(first.generated_at)
  })
})
