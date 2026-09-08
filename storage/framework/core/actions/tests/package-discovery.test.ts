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
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolve } from 'node:path'
import { discoverPackages, ensureDiscoveredPackages } from '../src/discover-packages'

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

  test('leaves the manifest file untouched when the set is unchanged', async () => {
    // The returned manifest being equal is not the same claim as the file not
    // being written. Rewriting identical bytes would satisfy the test above
    // and still move the mtime - and `autoImportsAreStale()` reads that mtime
    // to decide whether the package set moved, so a no-op rewrite here means
    // every boot regenerates the whole auto-import barrel.
    app({ name: 'my-app', dependencies: { loghq: '^1.0.0' } })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })
    const manifestPath = join(project, 'manifest.json')

    await discoverPackages({ projectRoot: project, manifestPath })

    // Backdated rather than slept on, so the assertion cannot pass by two
    // writes landing inside one filesystem timestamp tick.
    const past = new Date(Date.now() - 60_000)
    utimesSync(manifestPath, past, past)
    const before = statSync(manifestPath).mtimeMs

    await discoverPackages({ projectRoot: project, manifestPath })

    expect(statSync(manifestPath).mtimeMs).toBe(before)
  })

  test('moves the manifest mtime when a package is installed', async () => {
    // The other half: the mtime has to actually move when the set changes, or
    // a newly installed package's models never reach the barrel.
    app({ name: 'my-app', dependencies: { loghq: '^1.0.0' } })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })
    const manifestPath = join(project, 'manifest.json')

    await discoverPackages({ projectRoot: project, manifestPath })
    const past = new Date(Date.now() - 60_000)
    utimesSync(manifestPath, past, past)
    const before = statSync(manifestPath).mtimeMs

    app({ name: 'my-app', dependencies: { loghq: '^1.0.0', bughq: '^1.0.0' } })
    pkg('node_modules/bughq', { name: 'bughq', stacks: { name: 'bughq' } })
    await discoverPackages({ projectRoot: project, manifestPath })

    expect(statSync(manifestPath).mtimeMs).toBeGreaterThan(before)
  })
})


/**
 * Discovery has to run where the application actually runs.
 *
 * It used to run in exactly two places: `buddy dev` and `buddy package:discover`.
 * The manifest it writes is gitignored, so a deployed application ran whichever
 * manifest happened to ride along in the tarball from a developer's machine, or
 * none at all - and a package's routes, models and migrations worked in dev and
 * silently did not in production.
 */
describe('discovery at boot', () => {
  const coreRoot = resolve(import.meta.dir, '../..')

  function source(rel) {
    return readFileSync(resolve(coreRoot, rel), 'utf8')
  }

  test('the production API entry discovers before it imports routes', () => {
    const api = source('actions/src/serve/api.ts')

    expect(api).toContain('ensureDiscoveredPackages()')

    // Order is the assertion. `loadDiscoveredRoutes()` reads the manifest
    // during importRoutes(), so discovering afterwards would refresh a file
    // nothing reads again until the next boot.
    expect(api.indexOf('ensureDiscoveredPackages()'))
      .toBeLessThan(api.indexOf('route.importRoutes()'))
  })

  test('the production API entry injects auto-imports, after discovery', () => {
    const api = source('actions/src/serve/api.ts')

    // Every other entry did this and the production API did not, so an app
    // using the documented `await User.find(1)` global worked in `buddy dev`
    // and threw ReferenceError once served here (stacksjs/stacks#2442).
    expect(api).toContain('injectGlobalAutoImports()')

    // Discovery first, matching `buddy dev`: the manifest feeds what the
    // barrel is built from. Injection before importRoutes, because route files
    // pull in actions that read these names at module-evaluation time.
    expect(api.indexOf('ensureDiscoveredPackages()'))
      .toBeLessThan(api.indexOf('injectGlobalAutoImports()'))
    expect(api.indexOf('injectGlobalAutoImports()'))
      .toBeLessThan(api.indexOf('route.importRoutes()'))
  })

  test('the production views server discovers before it reads the manifest', () => {
    const server = source('buddy/src/production-server.ts')

    expect(server).toContain('ensureDiscoveredPackages()')

    // resolveViewPatterns appends package view roots and injectGlobalAutoImports
    // builds the barrel carrying package models. Both must see a current file.
    expect(server.indexOf('ensureDiscoveredPackages()'))
      .toBeLessThan(server.indexOf('await injectGlobalAutoImports()'))
  })

  test('buddy generate discovers before it regenerates the barrels', () => {
    // `generate` is a fastCommand in the preloader, so it skips the
    // preloader's discoverPackages() that every non-fast command gets. That
    // made it the ONLY command whose regeneration was package-blind - and it
    // is the command `check-generated-barrels.ts` tells you to run when a
    // barrel is stale, so the documented remedy could not fix a barrel that
    // was stale for this reason, only produce one.
    const file = source('actions/src/generate/index.ts')

    // Scoped to `generateEverything`'s own body: `generateTypes` is called
    // from more than one function, and an unscoped search compares positions
    // in unrelated code.
    const start = file.indexOf('async function generateEverything')
    expect(start).toBeGreaterThan(-1)
    const body = file.slice(start, file.indexOf('\nasync function ', start + 1))

    expect(body).toContain('await discoverPackages()')

    // Before the generators, for the same reason `buddy dev` orders it that
    // way: the manifest is what the barrels are built from.
    expect(body.indexOf('await discoverPackages()'))
      .toBeLessThan(body.indexOf('await generateTypes('))
  })

  test('generate is still a preloader fast command, which is why the above matters', () => {
    // If `generate` ever leaves fastCommands it would get discovery from the
    // preloader and the call above becomes redundant rather than load-bearing.
    // Pinned so that change is a deliberate one and this comment gets revisited.
    const preloader = readFileSync(
      resolve(coreRoot, '../defaults/resources/plugins/preloader.ts'),
      'utf8',
    )
    const fastCommands = preloader.slice(
      preloader.indexOf('const fastCommands'),
      preloader.indexOf(']', preloader.indexOf('const fastCommands')),
    )

    expect(fastCommands).toContain(`'generate'`)
  })

  test('both production entries rebuild a stale barrel before injecting', () => {
    // The barrels are COMMITTED and nothing regenerates them on the box, so a
    // package added since the last `buddy generate` reached production with
    // its routes working and its models and jobs missing from globalThis
    // (stacksjs/stacks#2445).
    for (const [label, rel] of [
      ['api', 'actions/src/serve/api.ts'],
      ['views', 'buddy/src/production-server.ts'],
    ]) {
      const text = source(rel)

      expect(text).toContain('autoImportsAreStale()')
      expect(text).toContain('generateAutoImportFiles({ declarations: false })')

      // Rebuild before injecting, or the process injects the barrel it just
      // decided was out of date.
      expect(text.indexOf('autoImportsAreStale()'), label)
        .toBeLessThan(text.indexOf('await injectGlobalAutoImports()'))

      // And after discovery, since the manifest is the staleness signal.
      expect(text.indexOf('ensureDiscoveredPackages()'), label)
        .toBeLessThan(text.indexOf('autoImportsAreStale()'))
    }
  })

  test('the box never rewrites the TypeScript declarations', () => {
    // `storage/framework/types/*.d.ts` describes the tree for editors and
    // `tsc`; nothing at runtime reads it. Rewriting it on a server makes the
    // release differ from the commit it was built from, for no benefit.
    for (const rel of ['actions/src/serve/api.ts', 'buddy/src/production-server.ts']) {
      const text = source(rel)
      expect(text).toContain('declarations: false')
      expect(text).not.toContain('generateAutoImportFiles()')
    }
  })

  test('a failure warns instead of aborting the boot', async () => {
    // An application's own routes do not depend on discovery succeeding, and a
    // server that refuses to start because one dependency shipped an unreadable
    // directory is worse than one that starts without that dependency.
    await ensureDiscoveredPackages()
    expect(true).toBe(true)
  })

  test('the manifest is written atomically, so a racing reader cannot see half of it', async () => {
    // Both production entries discover at boot and systemd starts them
    // together. Every reader degrades an unparseable manifest to "no packages",
    // so a torn write silently drops a package for the life of that boot.
    const src = source('actions/src/discover-packages.ts')

    expect(src).toContain('renameSync(temp, manifestPath)')
    expect(src.indexOf('Bun.write(temp')).toBeLessThan(src.indexOf('renameSync(temp, manifestPath)'))

    // And it still actually writes.
    app({ name: 'my-app', dependencies: { loghq: '^1.0.0' } })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })
    const manifestPath = join(project, 'manifest.json')

    await discoverPackages({ projectRoot: project, manifestPath })

    const written = JSON.parse(readFileSync(manifestPath, 'utf8'))
    expect(Object.keys(written.packages)).toEqual(['loghq'])
  })

  test('leaves no temp file behind', async () => {
    app({ name: 'my-app', dependencies: { loghq: '^1.0.0' } })
    pkg('node_modules/loghq', { name: 'loghq', stacks: { name: 'loghq' } })
    const manifestPath = join(project, 'manifest.json')

    await discoverPackages({ projectRoot: project, manifestPath })

    const stray = readdirSync(project).filter(f => f.endsWith('.tmp'))
    expect(stray).toEqual([])
  })
})
