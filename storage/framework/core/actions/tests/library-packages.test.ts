import type { LibraryBuildOptions, LibraryConfig } from '@stacksjs/types'
import { describe, expect, it } from 'bun:test'
import { rm } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { projectPath } from '@stacksjs/path'
import { buildLibraryPackages } from '../src/library/build'
import { functionEntryData } from '../src/library/entries'
import { ambientGlobalsUsed } from '../src/library/globals'
import { libraryManifest } from '../src/library/manifest'
import { publishCommand } from '../src/library/publish'
import {
  entrySpecifier,
  LibraryConfigError,
  normalizeLibraryPackages,
  resolveLibraryPackages,
} from '../src/library/packages'

describe('normalizeLibraryPackages', () => {
  it('reads the multi-package list', () => {
    const packages = normalizeLibraryPackages({
      license: 'MIT',
      packages: [
        { name: '@acme/fx', kind: 'functions' },
        { name: '@acme/ui', kind: 'components' },
        { name: '@acme/elements', kind: 'web-components' },
      ],
    })

    expect(packages.map(pkg => pkg.name)).toEqual(['@acme/fx', '@acme/ui', '@acme/elements'])
    expect(packages.map(pkg => pkg.kind)).toEqual(['functions', 'components', 'web-components'])
    // The scope is dropped for the build directory, and the library-wide
    // license flows down to a package that does not override it.
    expect(packages.map(pkg => pkg.slug)).toEqual(['fx', 'ui', 'elements'])
    expect(packages[0]?.license).toBe('MIT')
  })

  it('normalizes the single-package config into the same shape', () => {
    const packages = normalizeLibraryPackages({
      functions: { name: 'hello-fx', description: 'fx', keywords: ['fx'], files: ['counter', 'dark'] },
      webComponents: { name: 'hello-elements', description: 'el', keywords: ['el'], tags: [{ name: ['HelloWorld', 'AppHelloWorld'] }] },
    })

    expect(packages).toHaveLength(2)
    expect(packages[0]).toMatchObject({ name: 'hello-fx', kind: 'functions', include: ['counter.ts', 'dark.ts'] })
    // A `tags` list names the components, so it is also the include list —
    // otherwise a config naming two tags would quietly ship the whole
    // components directory.
    expect(packages[1]).toMatchObject({
      name: 'hello-elements',
      kind: 'web-components',
      include: ['HelloWorld.stx'],
      names: { HelloWorld: 'AppHelloWorld' },
    })
  })

  it('turns a [file, alias] tuple into a namespace re-export', () => {
    const packages = normalizeLibraryPackages({
      functions: { name: 'fx', description: '', keywords: [], files: [['counter', 'counters'] as unknown as string] },
    })

    expect(packages[0]?.aliases).toEqual({ counter: 'counters' })
  })

  it('ignores the legacy keys once `packages` is set', () => {
    const packages = normalizeLibraryPackages({
      packages: [{ name: '@acme/fx' }],
      functions: { name: 'legacy-fx', description: '', keywords: [] },
    })

    expect(packages.map(pkg => pkg.name)).toEqual(['@acme/fx'])
  })

  it('defaults to a functions package', () => {
    expect(normalizeLibraryPackages({ packages: [{ name: 'fx' }] })[0]?.kind).toBe('functions')
  })

  it('rejects two packages with the same npm name', () => {
    expect(() => normalizeLibraryPackages({
      packages: [{ name: '@acme/ui' }, { name: '@acme/ui' }],
    })).toThrow(LibraryConfigError)
  })

  it('rejects two packages that would build in the same directory', () => {
    // `@acme/ui` and `@other/ui` both unscope to `ui`, so one would silently
    // overwrite the other's dist.
    expect(() => normalizeLibraryPackages({
      packages: [{ name: '@acme/ui' }, { name: '@other/ui' }],
    })).toThrow(/both build in/)
  })

  it('accepts them once one sets an explicit dir', () => {
    const packages = normalizeLibraryPackages({
      packages: [{ name: '@acme/ui' }, { name: '@other/ui', dir: 'other-ui' }],
    })

    expect(packages.map(pkg => pkg.slug)).toEqual(['ui', 'other-ui'])
  })

  it('rejects a name that is not a valid npm name', () => {
    expect(() => normalizeLibraryPackages({ packages: [{ name: '../escape' }] })).toThrow(LibraryConfigError)
    expect(() => normalizeLibraryPackages({ packages: [{ name: '' }] })).toThrow(LibraryConfigError)
  })

  it('rejects an unknown kind', () => {
    expect(() => normalizeLibraryPackages({
      packages: [{ name: 'fx', kind: 'widgets' as 'functions' }],
    })).toThrow(/unknown kind/)
  })

  it('returns nothing when no library is configured', () => {
    expect(normalizeLibraryPackages(undefined)).toEqual([])
    expect(normalizeLibraryPackages({})).toEqual([])
  })
})

describe('resolveLibraryPackages', () => {
  const config: LibraryConfig = {
    packages: [
      { name: 'fx-all', kind: 'functions', include: ['*.ts'], runtime: 'stx' },
      { name: 'fx-counter', kind: 'functions', include: ['counter.ts'], runtime: 'stx' },
    ],
  }

  it('matches each package against resources/ independently', async () => {
    const packages = await resolveLibraryPackages(config)

    expect(packages[0]?.sources.length).toBeGreaterThan(1)
    expect(packages[1]?.sources.map(source => relative(projectPath(), source))).toEqual(['resources/functions/counter.ts'])
  })

  it('lets two packages claim the same file', async () => {
    const packages = await resolveLibraryPackages(config)
    const counter = projectPath('resources/functions/counter.ts')

    expect(packages[0]?.sources).toContain(counter)
    expect(packages[1]?.sources).toContain(counter)
  })

  it('subtracts `exclude` from `include`', async () => {
    const [pkg] = await resolveLibraryPackages({
      packages: [{ name: 'fx', kind: 'functions', include: ['*.ts'], exclude: ['dark.ts'], runtime: 'stx' }],
    })

    expect(pkg?.sources.map(source => relative(projectPath(), source))).toEqual(['resources/functions/counter.ts'])
  })

  it('fails on a package that matches nothing', async () => {
    // An empty match is a typo'd glob far more often than an empty package,
    // and the alternative is publishing an empty tarball.
    await expect(resolveLibraryPackages({
      packages: [{ name: 'fx', kind: 'functions', include: ['does-not-exist.ts'] }],
    })).rejects.toThrow(/matched no files/)
  })

  it('skips an unmatched package when asked to', async () => {
    const packages = await resolveLibraryPackages(
      { packages: [{ name: 'fx', kind: 'functions', include: ['does-not-exist.ts'] }] },
      { onUnmatched: 'skip' },
    )

    expect(packages).toEqual([])
  })
})

describe('entry points', () => {
  it('writes specifiers relative to the entry, with the extension the transpile rewrites', () => {
    const pkg = {
      name: 'fx',
      dir: '/project/storage/framework/libs/packages/fx',
      aliases: {},
    } as unknown as Parameters<typeof functionEntryData>[0]

    const data = functionEntryData(pkg, [
      '/project/storage/framework/libs/packages/fx/src/counter.ts',
      '/project/storage/framework/libs/packages/fx/src/dates/format.ts',
    ])

    expect(data).toContain("export * from './counter.ts'")
    expect(data).toContain("export * from './dates/format.ts'")
    // Absolute paths off the generating machine used to end up here, which
    // built only on that machine.
    expect(data).not.toContain('/project')
  })

  it('re-exports an aliased source as a namespace', () => {
    const pkg = {
      name: 'fx',
      dir: '/p/fx',
      aliases: { counter: 'counters' },
    } as unknown as Parameters<typeof functionEntryData>[0]

    expect(functionEntryData(pkg, ['/p/fx/src/counter.ts'])).toContain("export * as counters from './counter.ts'")
  })

  it('builds a relative specifier from an entry to a source', () => {
    expect(entrySpecifier('/p/pkg/src/index.ts', '/p/pkg/src/a/b.ts')).toBe('./a/b')
  })
})

describe('ambientGlobalsUsed', () => {
  const globals = new Set(['state', 'useDark', 'ref'])

  it('finds an ambient global a published package would not resolve', () => {
    expect(ambientGlobalsUsed('export const count = state(0)', globals)).toEqual(['state'])
  })

  it('ignores a name the file imports', () => {
    expect(ambientGlobalsUsed("import { state } from 'x'\nexport const c = state(0)", globals)).toEqual([])
  })

  it('ignores a name the file declares', () => {
    expect(ambientGlobalsUsed('function state() {}\nexport const c = state()', globals)).toEqual([])
  })

  it('ignores a property with the same name', () => {
    expect(ambientGlobalsUsed('export const c = window.state', globals)).toEqual([])
  })

  it('ignores the name inside a string or comment', () => {
    expect(ambientGlobalsUsed("// state(0)\nexport const c = 'state(0)'", globals)).toEqual([])
  })
})

describe('libraryManifest', () => {
  const base = {
    name: '@acme/ui',
    slug: 'ui',
    description: 'UI',
    keywords: ['ui'],
    private: false,
    access: 'public' as const,
    version: undefined,
    license: 'MIT',
    dependencies: {},
    peerDependencies: {},
  }

  it('follows the project version unless the package pins its own', () => {
    const pkg = { ...base, kind: 'functions' } as never

    expect(libraryManifest(pkg, {}, '1.2.3', []).version).toBe('1.2.3')
    expect(libraryManifest({ ...base, kind: 'functions', version: '9.9.9' } as never, {}, '1.2.3', []).version).toBe('9.9.9')
  })

  it('points a web-components package at the self-registering bundle', () => {
    const manifest = libraryManifest({ ...base, kind: 'web-components' } as never, {}, '1.0.0', [])

    expect(manifest.module).toBe('dist/bundle.js')
    expect((manifest.exports['.'] as { import: string }).import).toBe('./dist/bundle.js')
  })

  it('points a components package at the tree-shakeable index', () => {
    const manifest = libraryManifest({ ...base, kind: 'components' } as never, {}, '1.0.0', [])

    expect(manifest.module).toBe('dist/index.js')
    expect(manifest.exports['./style.css']).toBe('./dist/bundle.css')
  })

  it('marks a private package private and gives it no publish config', () => {
    const manifest = libraryManifest({ ...base, kind: 'functions', private: true } as never, {}, '1.0.0', [])

    expect(manifest.private).toBe(true)
    expect(manifest.publishConfig).toBeUndefined()
  })
})

describe('buildLibraryPackages', () => {
  it('builds several packages out of one resources tree', async () => {
    const config: LibraryConfig = {
      repository: 'acme/acme',
      license: 'MIT',
      packages: [
        { name: 'test-fx-counter', kind: 'functions', include: ['counter.ts'], runtime: 'stx' },
        { name: 'test-fx-dark', kind: 'functions', include: ['dark.ts'], runtime: 'stx' },
        // A named subset rather than the whole directory: this asserts that a
        // package claims only what it asked for, and keeps the compile small.
        { name: 'test-ui', kind: 'components', include: ['Taskbar.stx', 'Window.stx'], prefix: 'test' },
        { name: 'test-elements', kind: 'web-components', include: ['Taskbar.stx'], prefix: 'test' },
      ],
    }

    const reports = await buildLibraryPackages({ config })

    try {
      expect(reports.map(report => report.name)).toEqual(['test-fx-counter', 'test-fx-dark', 'test-ui', 'test-elements'])

      // Each package is self-contained: staged sources, its own barrel,
      // its own dist, its own manifest.
      const counter = projectPath('storage/framework/libs/packages/test-fx-counter')
      expect(await Bun.file(resolve(counter, 'dist/index.js')).text()).toContain('./counter.js')
      expect(await Bun.file(resolve(counter, 'dist/counter.js')).exists()).toBe(true)
      expect(await Bun.file(resolve(counter, 'dist/dark.js')).exists()).toBe(false)

      const dark = projectPath('storage/framework/libs/packages/test-fx-dark')
      expect(await Bun.file(resolve(dark, 'dist/dark.js')).exists()).toBe(true)

      const manifest = await Bun.file(resolve(counter, 'package.json')).json()
      expect(manifest.name).toBe('test-fx-counter')
      expect(manifest.stacks.sources).toEqual(['resources/functions/counter.ts'])

      // The component packages compile the same .stx files to custom elements.
      const ui = projectPath('storage/framework/libs/packages/test-ui')
      expect(await Bun.file(resolve(ui, 'dist/test-taskbar.js')).exists()).toBe(true)
      expect(await Bun.file(resolve(ui, 'dist/test-window.js')).exists()).toBe(true)

      const elements = projectPath('storage/framework/libs/packages/test-elements')
      expect(await Bun.file(resolve(elements, 'dist/bundle.js')).exists()).toBe(true)
      expect(await Bun.file(resolve(elements, 'dist/test-window.js')).exists()).toBe(false)
    }
    finally {
      for (const report of reports)
        await rm(report.dir, { recursive: true, force: true })
    }
  }, 120_000)

  it('refuses a standalone package whose sources need stx ambient globals', async () => {
    // `counter.ts` calls `state()`, which nothing exports. Bundled into a
    // published package it compiles and then throws `ReferenceError` on the
    // consumer's first call, so the build has to stop here.
    await expect(buildLibraryPackages({
      config: { packages: [{ name: 'test-fx-standalone', kind: 'functions', include: ['counter.ts'] }] },
    })).rejects.toThrow(/ambient globals/)
  })

  it('fails loudly when the requested kind has no packages', async () => {
    // `buddy build:functions` used to exit 0 having built nothing at all.
    await expect(buildLibraryPackages({
      kinds: ['functions'],
      config: { packages: [{ name: 'test-ui-only', kind: 'components', include: ['Taskbar.stx'] }] },
    })).rejects.toThrow(/No functions packages are configured/)
  })
})

/**
 * The generated library packages must not be workspace members
 * (stacksjs/stacks#2387).
 *
 * `buddy release` runs the entry generator before it bumps, so every release
 * wrote `package.json` files into `storage/framework/libs/packages/*`. That
 * path used to be a workspace glob, so the install that follows recorded three
 * directories in `bun.lock` that no checkout has: everything under
 * `libs/packages/` is gitignored. CI then failed at `bun install
 * --frozen-lockfile` with "lockfile had changes, but lockfile is frozen",
 * before a single job ran, taking lint, typecheck, test, compile and
 * artifact-freshness with it.
 *
 * It was fixed by hand twice (ab7b7e3, then again after v0.73.0) and came back
 * both times, because nothing stopped the glob from matching generated output.
 * This is that stop.
 */
describe('workspace globs vs generated packages (#2387)', () => {
  it('does not make the generated library packages workspace members', async () => {
    const manifest = await Bun.file(projectPath('package.json')).json()
    const workspaces: string[] = manifest.workspaces ?? []

    expect(workspaces).not.toContain('storage/framework/libs/packages/*')
  })

  it('keeps every workspace glob off the gitignored library output', async () => {
    // Stated as the rule rather than the one offending string, so a glob that
    // reaches the same directory by another spelling is caught too.
    const manifest = await Bun.file(projectPath('package.json')).json()
    const workspaces: string[] = manifest.workspaces ?? []

    const reachesGeneratedPackages = workspaces.filter(glob =>
      glob.replace(/\/\*+$/, '').replace(/\/+$/, '') === 'storage/framework/libs/packages',
    )

    expect(reachesGeneratedPackages).toEqual([])
  })

  it('control: the tracked libs workspace is still declared', async () => {
    // Without this, the assertions above pass just as well on an empty list,
    // and dropping every workspace would read as a fix.
    const manifest = await Bun.file(projectPath('package.json')).json()
    const workspaces: string[] = manifest.workspaces ?? []

    expect(workspaces).toContain('storage/framework/libs/*')
    expect(workspaces).toContain('storage/framework/core/*')
  })
})

describe('publishCommand', () => {
  it('publishes through pantry when it is installed', () => {
    // Pantry is the package manager this project ships and the only one of
    // the three that reaches the Pantry registry. A release that fell through
    // to `bun publish` went to npm and nowhere else.
    const which = Bun.which
    Bun.which = ((name: string) => (name === 'pantry' ? '/usr/local/bin/pantry' : null)) as typeof Bun.which

    try {
      expect(publishCommand()).toEqual(['pantry', 'publish'])
    }
    finally {
      Bun.which = which
    }
  })

  it('falls back to bun, and then to npm', () => {
    const which = Bun.which

    try {
      Bun.which = ((name: string) => (name === 'bun' ? '/usr/local/bin/bun' : null)) as typeof Bun.which
      expect(publishCommand()).toEqual(['bun', 'publish'])

      Bun.which = ((name: string) => (name === 'npm' ? '/usr/local/bin/npm' : null)) as typeof Bun.which
      expect(publishCommand()).toEqual(['npm', 'publish'])
    }
    finally {
      Bun.which = which
    }
  })

  it('says so rather than spawning something that is not there', () => {
    const which = Bun.which
    Bun.which = (() => null) as typeof Bun.which

    try {
      // Hardcoding a publisher that is absent turned this into an ENOENT
      // from deep inside a spawn, which named neither the cause nor the fix.
      expect(() => publishCommand()).toThrow(/pantry/)
    }
    finally {
      Bun.which = which
    }
  })
})

describe('single-package sugar honours include/exclude (stacksjs/stacks#2426)', () => {
  it('gives webComponents.include precedence over tags', () => {
    /*
     * Annotated as `LibraryBuildOptions` rather than inlined, so this also
     * covers the DECLARATION. Without `include` on that interface a direct
     * object literal fails with TS2353, which is what the issue reports; an
     * inline literal inside an `as LibraryConfig` cast would suppress the
     * excess-property check and quietly pass either way.
     *
     * `tags` alone contributes `<Name>.stx` and cannot reach a nested
     * directory, which is why `include` has to exist on this key.
     */
    const webComponents: LibraryBuildOptions = {
      name: '@acme/ui',
      description: 'ui',
      keywords: [],
      tags: [{ name: 'HelloWorld' }],
      include: ['charts/**'],
    }

    const [definition] = normalizeLibraryPackages({ webComponents } as LibraryConfig)

    expect(definition!.include).toEqual(['charts/**'])
  })

  it('gives functions.include precedence over files', () => {
    const [definition] = normalizeLibraryPackages({
      functions: {
        name: '@acme/fx',
        description: 'fx',
        keywords: [],
        files: ['counter'],
        include: ['dates/**'],
      },
    } as LibraryConfig)

    expect(definition!.include).toEqual(['dates/**'])
  })

  it('carries exclude through the same normalization', () => {
    const [definition] = normalizeLibraryPackages({
      functions: {
        name: '@acme/fx',
        description: 'fx',
        keywords: [],
        include: ['**/*.ts'],
        exclude: ['internal/**'],
      },
    } as LibraryConfig)

    expect(definition!.exclude).toEqual(['internal/**'])
  })

  it('still falls back to tags when include is absent', () => {
    const [definition] = normalizeLibraryPackages({
      webComponents: {
        name: '@acme/ui',
        description: 'ui',
        keywords: [],
        tags: [{ name: 'HelloWorld' }],
      },
    } as LibraryConfig)

    expect(definition!.include).toEqual(['HelloWorld.stx'])
  })
})
