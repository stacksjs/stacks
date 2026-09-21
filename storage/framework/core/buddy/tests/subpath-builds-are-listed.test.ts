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
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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
      // source, and the box bundles it with `bun build`, which resolves each
      // subpath through core/tsconfig.build.json. That mapping is pinned by
      // the next test, and it is what actually broke a deploy.
      'deploy': 'it ships source, and the box resolves subpaths through tsconfig.build.json paths, checked below',
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
})
