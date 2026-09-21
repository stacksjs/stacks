/**
 * Every workspace package imported by subpath is built before CI typechecks.
 *
 * A workspace package's ROOT export resolves from source when `dist` is
 * missing, but a subpath pattern like `./error-page` does not - the exports map
 * points its types at `./dist/*.d.ts`. `dist` is gitignored, so CI has none
 * unless something builds it, and the typecheck job went red with:
 *
 *   error TS2307: Cannot find module '@stacksjs/error-handling/handler'
 *   error TS2307: Cannot find module '@stacksjs/storage/uploaded-file'
 *
 * It stays green on developer machines because a stale `dist` is already
 * sitting there, which is exactly why nobody notices until CI does
 * (stacksjs/stacks#2056).
 *
 * `ci.yml` no longer carries the list by hand - it runs
 * `.github/scripts/subpath-packages.ts`, which computes it. This checks the
 * script still agrees with what the source actually imports, and that CI is
 * still asking it. The hand-written list was checked the same way, and the
 * check worked: it named `database`, then `path`. Both times it named them
 * after main had already gone red, for a package nobody had reason to know
 * needed listing.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = new URL('../../../../../', import.meta.url).pathname
const coreDir = join(root, 'storage/framework/core')

/** Workspace package names, by directory. */
function workspacePackages(): Map<string, string> {
  const byName = new Map<string, string>()

  for (const entry of readdirSync(coreDir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue
    try {
      const manifest = JSON.parse(readFileSync(join(coreDir, entry.name, 'package.json'), 'utf-8'))
      if (manifest.name)
        byName.set(manifest.name, entry.name)
    }
    catch {}
  }

  return byName
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return found
  }

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'dist' && entry.name !== 'node_modules')
        sourceFiles(full, found)
    }
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      found.push(full)
    }
  }

  return found
}

describe('subpath imports', () => {
  it('are all built first, per the script ci.yml runs', async () => {
    const packages = workspacePackages()
    const { subpathBuildTargets } = await import('../../../../../.github/scripts/subpath-packages')
    const listed = new Set(subpathBuildTargets())

    const needed = new Set<string>()
    // The defaults tree as well as the core packages. Nothing under `core`
    // imports `@stacksjs/browser` by subpath, but
    // `defaults/functions/dashboard-api.ts` imports
    // `@stacksjs/browser/composables/csrf` - so a scan of `core` alone said
    // `browser` was unneeded, and dropping it turned every test run into
    // `Cannot find module`.
    const scanned = [
      ...[...packages.values()].flatMap(dir => sourceFiles(join(coreDir, dir, 'src'))),
      ...sourceFiles(join(root, 'storage/framework/defaults')),
    ]
    {
      for (const file of scanned) {
        /*
         * Real import statements only. Half these packages document themselves
         * with `* import { X } from '@stacksjs/email/drivers/log'` in a JSDoc
         * block, and counting those put four packages on this list that CI
         * never needed to build.
         */
        const source = readFileSync(file, 'utf-8')
          .split('\n')
          .filter((line) => {
            const code = line.trimStart()
            return !code.startsWith('*') && !code.startsWith('//') && !code.startsWith('/*')
          })
          .join('\n')

        /*
         * Static AND dynamic. The imports that actually broke the typecheck
         * were `await import('@stacksjs/error-handling/handler')` inside the
         * router's error path, which a `from '...'` pattern alone does not see.
         */
        const specifiers = [
          ...source.matchAll(/from '(@stacksjs\/[a-z0-9-]+)\/[^']+'/g),
          ...source.matchAll(/\bimport\('(@stacksjs\/[a-z0-9-]+)\/[^']+'\)/g),
        ]

        for (const match of specifiers) {
          const importedDir = packages.get(match[1]!)
          // A package importing its OWN subpath needs a dist too - `storage`
          // does exactly that with `@stacksjs/storage/image`.
          if (importedDir)
            needed.add(importedDir)
        }
      }
    }

    const missing = [...needed].filter(dir => !listed.has(dir))
    expect(missing.sort()).toEqual([])
  })

  /**
   * The script is only worth anything if CI actually runs it. A workflow that
   * went back to a hand-written list would pass the check above and be exactly
   * as stale as before.
   */
  it('are built by the computed set, not a list typed into the workflow', () => {
    const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf-8')

    const loops = [...workflow.matchAll(/for pkg in (.+?); do/g)].map(match => match[1]!)

    expect(loops.length).toBeGreaterThan(0)
    for (const loop of loops)
      expect(loop).toBe('$(bun .github/scripts/subpath-packages.ts)')
  })

  /**
   * The computed set only protects a job that runs it.
   *
   * `typecheck` and `test` built it; `compile` and `artifact-freshness` never
   * did, and both went red the day the router started importing
   * `@stacksjs/logging/runtime`. With `compile` red, `deploy` was skipped on
   * every push to main, and nothing here said so: the two checks above were
   * both satisfied.
   *
   * So this fails closed. A job is assumed to load framework source, and must
   * build the set before any step that runs it, unless it is exempted below
   * with the reason it does not need to. A new job fails here until someone
   * decides which it is, instead of turning main red the first time it
   * imports a subpath.
   */
  it('are built by every job that loads framework source, before it does', () => {
    const workflow = Bun.YAML.parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf-8')) as {
      jobs: Record<string, { steps: Array<{ name?: string, run?: string }> }>
    }
    const exempt: Record<string, string> = {
      'lint': 'pickier reads files rather than resolving imports, and `bun buddy lint` loads no subpath',
      'scaffold-smoke': 'it typechecks a freshly scaffolded app against the PUBLISHED framework, not this checkout',
      'deployment-target': 'it installs nothing and imports no framework package',
      // Not because anything builds on the runner: the Hetzner deploy ships
      // source, and the box resolves each subpath through tsconfig `paths` -
      // core/tsconfig.build.json for what `bun build` bundles, the root
      // tsconfig for what the running server loads. Both are pinned by the
      // tests below, and each has broken the box once.
      'deploy': 'it ships source, and the box resolves subpaths through tsconfig paths, checked below',
      'publish-commit': 'it runs the full `bun run build` before publishing',
    }

    const builds = (step: { run?: string }): boolean => String(step.run ?? '').includes('bun .github/scripts/subpath-packages.ts')
    // A step that runs framework code: anything but installing, provisioning,
    // or the repo's own standalone checks.
    const loadsFramework = (step: { run?: string }): boolean => {
      const run = String(step.run ?? '')
      return /\bbun (run|test)\b|\bbuddy\b/.test(run) && !builds(step)
    }

    const problems: string[] = []
    for (const [name, job] of Object.entries(workflow.jobs)) {
      if (name in exempt)
        continue
      const built = job.steps.findIndex(builds)
      const firstUse = job.steps.findIndex(loadsFramework)
      if (built === -1)
        problems.push(`${name}: never builds the subpath set`)
      else if (firstUse !== -1 && firstUse < built)
        problems.push(`${name}: "${job.steps[firstUse].name}" runs before the subpath set is built`)
    }
    expect(problems).toEqual([])

    // An exemption for a job that is gone is a stale reason, not a safe one.
    for (const name of Object.keys(exempt))
      expect(Object.keys(workflow.jobs)).toContain(name)
  })

  /**
   * Where no `dist/` exists, a subpath resolves only through
   * core/tsconfig.build.json.
   *
   * The production box never has a `dist/`: the deploy ships source and
   * bundles it there with `bun build`, which honours these `paths`. The
   * catch-all `@stacksjs/*` does not cover a subpath - it binds the wildcard to
   * the whole remainder, so `@stacksjs/logging/runtime` looks for
   * `./logging/runtime/src` and falls back to the missing `dist/` - so every
   * package imported by subpath needs its own entry. That list is typed by
   * hand, and the router's import of `@stacksjs/logging/runtime` had none, so
   * the first deploy to reach the box failed with "Could not resolve" four
   * times while CI, which builds `dist/`, stayed green.
   *
   * Type-only imports are skipped: the bundler erases them.
   */
  it('resolve to source through tsconfig.build.json, which is all the deploy box has', () => {
    const tsconfig = Bun.JSONC.parse(readFileSync(join(coreDir, 'tsconfig.build.json'), 'utf-8')) as { compilerOptions: { paths: Record<string, string[]> } }
    const mapped = Object.keys(tsconfig.compilerOptions.paths)
    const covers = (specifier: string): boolean => mapped.some(key => key.endsWith('/*')
      ? key !== '@stacksjs/*' && specifier.startsWith(key.slice(0, -1))
      : key === specifier)

    const packages = workspacePackages()
    const governed = [...packages.values()].filter((dir) => {
      try {
        return readFileSync(join(coreDir, dir, 'tsconfig.json'), 'utf-8').includes('tsconfig.build.json')
      }
      catch {
        return false
      }
    })

    const unmapped: string[] = []
    for (const dir of governed) {
      for (const file of sourceFiles(join(coreDir, dir, 'src'))) {
        const source = readFileSync(file, 'utf-8')
          .split('\n')
          .filter((line) => {
            const code = line.trimStart()
            return !code.startsWith('*') && !code.startsWith('//') && !code.startsWith('/*')
          })
          .join('\n')
        const specifiers = [
          ...[...source.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'\n]*?from '(@stacksjs\/([a-z0-9-]+)\/[^']+)'/gm)].map(m => [m[1]!, m[2]!]),
          ...[...source.matchAll(/(?<!typeof )\bimport\('(@stacksjs\/([a-z0-9-]+)\/[^']+)'\)/g)].map(m => [m[1]!, m[2]!]),
        ]
        for (const [specifier, name] of specifiers) {
          if (packages.has(`@stacksjs/${name}`) && !covers(specifier!))
            unmapped.push(`${file.slice(coreDir.length + 1)} imports ${specifier}`)
        }
      }
    }

    expect([...new Set(unmapped)].sort()).toEqual([])
  })

  /**
   * What the running server loads resolves to source too, not only what
   * `bun build` bundled.
   *
   * The test above covers serve.js. Two things on the box are never bundled:
   * serve.js imports the auto-import barrels by path at boot, and the stx
   * bundler builds each page's client script there on first request. Both
   * resolve `storage/framework/defaults` through the ROOT tsconfig.json, which
   * extends tsconfig.app.json, and that list had no `@stacksjs/browser/*`. So
   * every `@stacksjs/browser/composables/*` import in `defaults/functions`
   * fell back to the missing `dist/`:
   *
   *   [auto-imports] functions.ts failed to load, so nothing it exports is
   *   available. ... Cause: Cannot find package '@stacksjs/browser' imported
   *   from storage/framework/defaults/functions/commerce/coupons.ts
   *
   *   [stx:bundler] error: .../Dashboard/Auth/LoginDashboard.stx: Could not
   *   resolve: "@stacksjs/browser/composables/csrf"
   *
   * The second is the one a visitor meets: /login, /register,
   * /forgot-password and /password/reset shipped their script unbundled, an
   * `import` inside a `try`, which does not parse, so none of those forms did
   * anything.
   *
   * CI builds `dist/` first, so there the same imports resolved, to `dist/`.
   * Hence Bun's own resolver, asked from the importing file so the governing
   * tsconfig is the one the box uses, and a failure on `dist/` as well as on
   * a miss: the box has nothing at either.
   *
   * The walk starts from what the server loads by path: the barrels, the
   * files the name-to-path barrels (actions, middleware, ...) point at, the
   * route files, userland and framework `app/`, config, and the script
   * blocks of every framework and site template.
   */
  it('resolve to source from everything the server loads at runtime, which is not bundled', () => {
    const packages = workspacePackages()
    const transpiler = new Bun.Transpiler({ loader: 'ts' })
    const relative = (file: string): string => file.slice(root.length)

    // Value imports only: the transpiler drops what is used as a type alone,
    // exactly as the runtime does.
    const importsOf = (code: string): string[] => {
      try {
        return transpiler.scanImports(code).map(entry => entry.path)
      }
      catch {
        // A few stx client scripts hold syntax the TypeScript scanner
        // rejects. Their import lines are ordinary ones.
        return [
          ...code.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm),
          ...code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g),
        ].map(match => match[1]!)
      }
    }

    // What the server loads by path. Everything they reach is walked from here.
    const queue: Array<{ file: string, code: string }> = []
    const enqueue = (file: string): void => {
      queue.push({ file, code: readFileSync(file, 'utf-8') })
    }
    const barrels = join(root, 'storage/framework/auto-imports')
    for (const entry of readdirSync(barrels)) {
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts'))
        continue
      const barrel = join(barrels, entry)
      enqueue(barrel)
      // actions, middleware, emails, listeners and policies map names to
      // paths instead of importing them, and the server imports each target.
      for (const target of readFileSync(barrel, 'utf-8').matchAll(/['"](\.\.?\/[^'"]+\.ts)['"]/g)) {
        const file = join(barrels, target[1]!)
        if (existsSync(file))
          enqueue(file)
      }
    }
    for (const pattern of ['routes/**/*.ts', 'app/**/*.ts', 'config/*.ts', 'storage/framework/defaults/app/**/*.ts']) {
      for (const entry of new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: true }))
        enqueue(join(root, entry))
    }
    const defaults = join(root, 'storage/framework/defaults')
    for (const pattern of ['storage/framework/defaults/**/*.stx', 'resources/**/*.stx']) {
      for (const entry of new Bun.Glob(pattern).scanSync({ cwd: root, onlyFiles: true })) {
        const source = readFileSync(join(root, entry), 'utf-8')
        for (const block of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
          if (!/\bsrc=/.test(block[1]!))
            queue.push({ file: join(root, entry), code: block[2]! })
        }
      }
    }

    const walked = new Set<string>()
    const problems: string[] = []
    let checked = 0

    while (queue.length > 0) {
      const { file, code } = queue.pop()!

      for (const specifier of importsOf(code)) {
        const name = /^@stacksjs\/[a-z0-9-]+/.exec(specifier)?.[0]
        const workspace = name !== undefined && packages.has(name)
        if (!workspace && !specifier.startsWith('.') && !specifier.startsWith('~/'))
          continue

        let resolved: string
        try {
          resolved = Bun.resolveSync(specifier, dirname(file))
        }
        catch {
          // A broken relative import is a different bug, and not this test's.
          if (workspace)
            problems.push(`${relative(file)} imports ${specifier}, which does not resolve without dist/`)
          continue
        }

        if (workspace) {
          checked++
          if (resolved.split('/').includes('dist')) {
            problems.push(`${relative(file)} imports ${specifier}, which resolves only to ${relative(resolved)}`)
            continue
          }
        }

        if (resolved.startsWith(root) && !resolved.includes('/node_modules/') && /\.[cm]?[jt]sx?$/.test(resolved) && !walked.has(resolved)) {
          walked.add(resolved)
          queue.push({ file: resolved, code: readFileSync(resolved, 'utf-8') })
        }
      }
    }

    // Guards the walk itself: a scanner that found nothing would pass.
    expect(checked).toBeGreaterThan(0)
    expect([...walked].some(file => file.startsWith(join(defaults, 'functions/')))).toBe(true)
    expect([...new Set(problems)].sort()).toEqual([])
  })
})
