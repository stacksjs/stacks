import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULTS_SYNC_MARKER, installedDefaultsVersion } from '@stacksjs/path'
import {
  alignBunPins,
  detectProjectAiProviders,
  measureDefaultsDrift,
  migratePackageProjectManifest,
  migratePackageProjectTsconfig,
  raiseBunPins,
  summarizeStructureChanges,
  syncPackageProjectFiles,
  vendorDefaultsTree,
} from '../src/upgrade/package-project'

let root: string
let defaultsRoot: string

function write(path: string, contents: string): void {
  const full = join(root, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
}

function writeDefault(path: string, contents: string): void {
  const full = join(defaultsRoot, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-package-project-'))
  defaultsRoot = join(root, 'node_modules/@stacksjs/defaults')
  writeDefault('package.json', '{"name":"@stacksjs/defaults","version":"0.70.362"}')
  writeDefault('ai/skills/stacks-buddy/SKILL.md', 'current skill')
  writeDefault('project/buddy', '#!/bin/sh\n')
  writeDefault('project/bootstrap', '#!/bin/sh\n')
  writeDefault('project/storage/framework/tsconfig.app.json', '{"app":true}\n')
  writeDefault('project/storage/framework/tsconfig.base.json', '{"base":true}\n')
  writeDefault('project/storage/framework/server/tsconfig.docker.json', '{"docker":true}\n')
  // A vendored app, which is what every sync test below describes. The
  // package-based layout, with no tree or a link to the package, has its own.
  mkdirSync(join(root, 'storage/framework/defaults'), { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('package project manifest migration', () => {
  it('preserves application type-check pipelines and aliases', () => {
    const scripts = {
      buddy: './buddy',
      typecheck: 'bun run typecheck:app && bun run typecheck:tools && bun run typecheck:views',
      'typecheck:app': 'bun x --bun tsc --noEmit -p tsconfig.json --pretty false',
      'types:check': 'bun run typecheck',
      'typecheck:tools': 'bun x --bun tsc --noEmit -p tsconfig.tools.json',
    }
    const original = { ...scripts }
    expect(migratePackageProjectManifest({ scripts })).toEqual([])
    expect(scripts).toEqual(original)
  })

  it('repairs checks that still target the removed framework source', () => {
    const pkg = { scripts: {
      typecheck: 'bun tsc --noEmit -p storage/framework/tsconfig.framework.json',
      'typecheck:app': 'bun tsc --noEmit -p storage/framework/core/tsconfig.json',
      'types:check': 'bun run build:framework-types && bun tsc --noEmit',
    } }
    migratePackageProjectManifest(pkg)
    expect(pkg.scripts.typecheck).toContain('-p tsconfig.json')
    expect(pkg.scripts['typecheck:app']).toContain('-p tsconfig.json')
    expect(pkg.scripts['types:check']).toBe('bun tsc --noEmit')
    expect(migratePackageProjectManifest(pkg)).toEqual([])
  })

  it('removes only obsolete steps from mixed application check pipelines', () => {
    const pkg = { scripts: {
      typecheck: 'bun run build:framework-types && bun run typecheck:app && bun run typecheck:views',
      'typecheck:app': 'bun tsc --noEmit -p storage/framework/tsconfig.framework.json && bun run custom-check',
      'types:check': 'bun run typecheck && bun run typecheck:tools',
      'build:framework-types': 'bun --filter core run build',
    } }
    migratePackageProjectManifest(pkg)
    expect(pkg.scripts.typecheck).toBe('bun run typecheck:app && bun run typecheck:views')
    expect(pkg.scripts['typecheck:app']).toBe('bun x --bun tsc --noEmit -p tsconfig.json --pretty false && bun run custom-check')
    expect(pkg.scripts['types:check']).toBe('bun run typecheck && bun run typecheck:tools')
    expect(pkg.scripts['build:framework-types']).toBeUndefined()
    expect(migratePackageProjectManifest(pkg)).toEqual([])
  })

  it('preserves quoted arguments and complex application shell commands', () => {
    const scripts = {
      typecheck: 'bun run build:framework-types && bun run check --label "app && views"',
      'typecheck:app': 'if test -f custom.json; then bun run build:framework-types; fi',
      'types:check': 'bun run typecheck',
      'build:framework-types': 'bun --filter core run build',
    }
    migratePackageProjectManifest({ scripts })
    expect(scripts.typecheck).toBe('bun run check --label "app && views"')
    expect(scripts['typecheck:app']).toBe('if test -f custom.json; then bun run build:framework-types; fi')
    expect(scripts['build:framework-types']).toBe('bun --filter core run build')
  })

  for (const suffix of [' > type-errors.txt', ' # application annotation']) {
    it(`preserves application shell syntax: ${suffix.trim()}`, () => {
      const typecheck = `bun tsc --noEmit -p storage/framework/core/tsconfig.json${suffix}`
      const pkg = { scripts: { typecheck } }
      migratePackageProjectManifest(pkg)
      expect(pkg.scripts.typecheck).toBe(typecheck)
    })
  }

  it('migrates local compiler commands while preserving view validation', () => {
    const pkg = { scripts: { typecheck: 'tsc --noEmit -p storage/framework/core/tsconfig.json && bun run typecheck:views' } }
    migratePackageProjectManifest(pkg)
    expect(pkg.scripts.typecheck).toBe('bun x --bun tsc --noEmit -p tsconfig.json --pretty false && bun run typecheck:views')
  })

  it('supplies missing app checks without replacing custom ones', () => {
    const pkg = { scripts: { typecheck: 'bun run custom-type-validation' } }
    migratePackageProjectManifest(pkg)
    expect(pkg.scripts.typecheck).toBe('bun run custom-type-validation')
    expect(pkg.scripts).toMatchObject({
      'typecheck:app': 'bun x --bun tsc --noEmit -p tsconfig.json --pretty false',
      'types:check': 'bun run typecheck',
    })
  })

  it('removes core workspaces and legacy framework build scripts', () => {
    const pkg = {
      scripts: {
        buddy: 'bun ./storage/framework/core/buddy/src/cli.ts',
        'build:reset': 'rm -rf node_modules && pantry install && cd storage/framework && bun run build && cd ../../',
        typecheck: 'bun run build:framework-types && bun x tsc --noEmit',
        'build:framework-types': 'bun --filter core run build',
      },
      workspaces: [
        'storage/framework',
        'storage/framework/core',
        'storage/framework/core/*',
      ],
    }

    const changes = migratePackageProjectManifest(pkg)

    expect(changes.length).toBeGreaterThan(0)
    expect(pkg.scripts.buddy).toBe('./buddy')
    expect(pkg.scripts['build:reset']).not.toContain('storage/framework')
    expect(pkg.scripts.typecheck).toBe('bun x tsc --noEmit')
    expect(pkg.scripts['build:framework-types']).toBeUndefined()
    expect(pkg.workspaces).toEqual(['storage/framework'])
  })
})

describe('package project file sync', () => {
  it('delivers bundled skills and references to package-based apps', () => {
    const bundled = join(import.meta.dir, '../../../defaults/ai/skills')
    const skills = ['stacks-humanizer', 'stacks-unslop', 'stacks-marketing-copywriting', 'stacks-implement-spec', 'stacks-marketing', 'stacks-flow', 'stacks-native', 'stacks-forms', 'stacks-models']

    for (const name of skills)
      cpSync(join(bundled, name), join(defaultsRoot, 'ai/skills', name), { recursive: true })

    syncPackageProjectFiles(root, defaultsRoot)

    const installed = join(root, 'storage/framework/defaults/ai/skills')
    for (const name of skills) {
      for (const file of ['SKILL.md', ...(existsSync(join(bundled, name, 'NOTICE.md')) ? ['NOTICE.md'] : [])]) {
        expect(readFileSync(join(installed, name, file), 'utf8'))
          .toBe(readFileSync(join(bundled, name, file), 'utf8'))
      }
    }
    expect(readFileSync(join(installed, 'stacks-humanizer/LICENSE'), 'utf8')).toContain('MIT License')
    for (const file of ['core-contract.md', 'voice.md', 'presets.md']) {
      expect(readFileSync(join(installed, 'stacks-unslop/references', file), 'utf8'))
        .toBe(readFileSync(join(bundled, 'stacks-unslop/references', file), 'utf8'))
    }
    for (const path of ['stacks-marketing-copywriting/PLAYBOOK.md', 'stacks-implement-spec/PLAYBOOK.md', 'stacks-flow/upstream-skills.json', 'stacks-flow/ENGINEERING.md', 'stacks-marketing/WORKFLOW.md', 'stacks-native/CATALOG.md', 'stacks-native/CAPABILITIES.md', 'stacks-native/RECIPES.md', 'stacks-models/references/model-capabilities.md']) {
      expect(readFileSync(join(installed, path), 'utf8')).toBe(readFileSync(join(bundled, path), 'utf8'))
    }
  })

  it('refreshes defaults, removes stale managed files, and installs support files', () => {
    write('storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md', 'old skill')
    write('storage/framework/defaults/ai/skills/removed/SKILL.md', 'stale skill')
    write('storage/framework/defaults/.discovered-models.json', '{}')
    write('pantry.lock', 'legacy workspace lock')

    const changes = syncPackageProjectFiles(root, defaultsRoot)

    expect(changes.some(change => change.path === 'storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md')).toBe(true)
    expect(readFileSync(join(root, 'storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md'), 'utf8')).toBe('current skill')
    expect(existsSync(join(root, 'storage/framework/defaults/ai/skills/removed'))).toBe(false)
    expect(existsSync(join(root, 'storage/framework/defaults/.discovered-models.json'))).toBe(true)
    expect(existsSync(join(root, 'pantry.lock'))).toBe(false)
    expect(readFileSync(join(root, 'storage/framework/tsconfig.app.json'), 'utf8')).toContain('"app"')
    expect(readFileSync(join(root, 'storage/framework/server/tsconfig.docker.json'), 'utf8')).toContain('"docker"')
    expect(lstatSync(join(root, 'buddy')).mode & 0o111).not.toBe(0)
  })

  it('reports a dry run without writing any project files', () => {
    const changes = syncPackageProjectFiles(root, defaultsRoot, { dryRun: true })

    expect(changes.length).toBeGreaterThan(0)
    expect(readdirSync(join(root, 'storage/framework/defaults'))).toEqual([])
    expect(existsSync(join(root, 'buddy'))).toBe(false)
  })
})

describe('package project file sync without a vendored tree', () => {
  it('does not create storage/framework/defaults, but still installs support files', () => {
    rmSync(join(root, 'storage/framework/defaults'), { recursive: true })

    const changes = syncPackageProjectFiles(root, defaultsRoot)

    expect(existsSync(join(root, 'storage/framework/defaults'))).toBe(false)
    expect(changes.some(change => change.path.startsWith('storage/framework/defaults'))).toBe(false)
    expect(readFileSync(join(root, 'storage/framework/tsconfig.app.json'), 'utf8')).toContain('"app"')
    expect(measureDefaultsDrift(root)?.some(change => change.path.startsWith('storage/framework/defaults'))).toBe(false)
  })

  it('never writes through the link into the installed package', () => {
    rmSync(join(root, 'storage/framework/defaults'), { recursive: true })
    symlinkSync('../../node_modules/@stacksjs/defaults', join(root, 'storage/framework/defaults'), 'dir')

    const changes = syncPackageProjectFiles(root, defaultsRoot)

    expect(changes.some(change => change.path.startsWith('storage/framework/defaults'))).toBe(false)
    expect(existsSync(join(defaultsRoot, DEFAULTS_SYNC_MARKER))).toBe(false)
    expect(readdirSync(defaultsRoot).sort()).toEqual(['ai', 'package.json', 'project'])
  })
})

describe('the VS Code extension in the defaults', () => {
  // wildloop, stacks 0.75.62: the extension's sources and tests reached the app
  // through the sync, and its root `bun test` failed on imports that exist only
  // in the framework repository, which stopped every deploy.
  it('stay out of the defaults package, apart from the settings and manifest', () => {
    const build = readFileSync(join(import.meta.dir, '../../defaults/build.ts'), 'utf8')
    expect(build).toContain(`join(defaults, 'ide/vscode', path)`)
    for (const path of ['\'src\'', '\'tests\'', '\'scripts\'', '\'build.ts\'', '\'tsconfig.json\''])
      expect(build).toContain(path)
    expect(build).toContain('filter: shipsToApps')
  })

  it('are removed from an app once the package stops shipping them', () => {
    writeDefault('ide/vscode/package.json', '{"name":"stacks"}')
    writeDefault('ide/vscode/.vscode/settings.json', '{}')
    write('storage/framework/defaults/ide/vscode/package.json', '{"name":"stacks"}')
    write('storage/framework/defaults/ide/vscode/.vscode/settings.json', '{}')
    write('storage/framework/defaults/ide/vscode/src/extension.ts', 'import \'../../../../core/actions/src/lint/files\'\n')
    write('storage/framework/defaults/ide/vscode/tests/manifest.test.ts', 'test\n')
    write('storage/framework/defaults/ide/vscode/build.ts', 'build\n')

    const changes = syncPackageProjectFiles(root, defaultsRoot)

    expect(existsSync(join(root, 'storage/framework/defaults/ide/vscode/src'))).toBe(false)
    expect(existsSync(join(root, 'storage/framework/defaults/ide/vscode/tests'))).toBe(false)
    expect(existsSync(join(root, 'storage/framework/defaults/ide/vscode/build.ts'))).toBe(false)
    expect(existsSync(join(root, 'storage/framework/defaults/ide/vscode/.vscode/settings.json'))).toBe(true)
    expect(changes).toContainEqual({ path: 'storage/framework/defaults/ide/vscode/tests', action: 'remove' })
  })
})

describe('framework type declarations', () => {
  it.each([false, true])('retires obsolete trait request declarations (vendored: %s)', (vendorDefaults) => {
    // These described the removed Request class, including a string `body`
    // and synchronous validation. No current generator or caller uses them.
    const retired = 'storage/framework/types/traits.d.ts'
    write(retired, "import { Request } from '../core/router/src/request'\n")
    write('storage/framework/types/custom.d.ts', 'export interface Campaign { seed: number }\n')

    const preview = syncPackageProjectFiles(root, defaultsRoot, { vendorDefaults, dryRun: true })
    expect(preview).toContainEqual({ path: retired, action: 'remove' })
    expect(existsSync(join(root, retired))).toBe(true)

    const applied = syncPackageProjectFiles(root, defaultsRoot, { vendorDefaults })
    expect(applied).toContainEqual({ path: retired, action: 'remove' })
    expect(existsSync(join(root, retired))).toBe(false)
    expect(readFileSync(join(root, 'storage/framework/types/custom.d.ts'), 'utf8'))
      .toBe('export interface Campaign { seed: number }\n')
    expect(syncPackageProjectFiles(root, defaultsRoot, { vendorDefaults })).toEqual([])
  })

  // trifitla upgraded 0.72.57 -> 0.75.11 and its own app/Events.ts stopped
  // typechecking: `'user:created'` lives on AppEvents through
  // storage/framework/types/model-events.d.ts, which `buddy new` ships and
  // `buddy upgrade` never delivered.
  it('adds and updates them, leaving generated and legacy files alone', () => {
    writeDefault('project/storage/framework/types/model-events.d.ts', 'model events\n')
    writeDefault('project/storage/framework/types/env.d.ts', 'current env\n')
    writeDefault('project/storage/framework/types/src/auth.ts', 'auth\n')
    writeDefault('project/storage/framework/types/server-auto-imports.d.ts', 'the framework\'s own\n')
    write('storage/framework/types/env.d.ts', 'old env\n')
    write('storage/framework/types/server-auto-imports.d.ts', 'this app\'s globals\n')
    write('storage/framework/types/events.ts', 'legacy generated events\n')

    const changes = syncPackageProjectFiles(root, defaultsRoot)

    expect(readFileSync(join(root, 'storage/framework/types/model-events.d.ts'), 'utf8')).toBe('model events\n')
    expect(readFileSync(join(root, 'storage/framework/types/env.d.ts'), 'utf8')).toBe('current env\n')
    expect(readFileSync(join(root, 'storage/framework/types/src/auth.ts'), 'utf8')).toBe('auth\n')
    expect(readFileSync(join(root, 'storage/framework/types/server-auto-imports.d.ts'), 'utf8')).toBe('this app\'s globals\n')
    expect(readFileSync(join(root, 'storage/framework/types/events.ts'), 'utf8')).toBe('legacy generated events\n')

    expect(changes).toContainEqual({ path: 'storage/framework/types/model-events.d.ts', action: 'add' })
    expect(changes).toContainEqual({ path: 'storage/framework/types/env.d.ts', action: 'update' })
    expect(changes.some(change => change.path.endsWith('server-auto-imports.d.ts'))).toBe(false)
    expect(changes.some(change => change.action === 'remove' && change.path.startsWith('storage/framework/types'))).toBe(false)

    expect(syncPackageProjectFiles(root, defaultsRoot).filter(change => change.path.startsWith('storage/framework/types'))).toEqual([])
  })

  it('are a managed path for vendored apps too, minus the generated ones', async () => {
    const { MANAGED_PATHS } = await import('../src/upgrade/framework-utils')
    const types = MANAGED_PATHS.find(managed => managed.localPath === 'storage/framework/types')
    expect(types?.subPath).toBe('storage/framework/types')
    expect(types?.skip).toEqual(expect.arrayContaining(['server-auto-imports.d.ts', 'browser-auto-imports.d.ts']))
  })

  it('ship in the defaults package, minus the generated ones', () => {
    const build = readFileSync(join(import.meta.dir, '../../defaults/build.ts'), 'utf8')
    expect(build).toContain(`join(here, 'project/storage/framework/types')`)
    expect(build).toContain('server-auto-imports.d.ts')
    expect(existsSync(join(import.meta.dir, '../../../types/model-events.d.ts'))).toBe(true)
  })
})

describe('framework defaults provenance', () => {
  const markerPath = (): string => join(root, 'storage/framework/defaults', DEFAULTS_SYNC_MARKER)

  it('stamps the tree with the version it was synced from', () => {
    syncPackageProjectFiles(root, defaultsRoot)

    const marker = JSON.parse(readFileSync(markerPath(), 'utf8'))
    expect(marker.version).toBe('0.70.362')
    expect(Number.isNaN(Date.parse(marker.syncedAt))).toBe(false)
    expect(installedDefaultsVersion(root)).toBe('0.70.362')
  })

  it('leaves the stamp alone on a later sync, and never counts it as drift', () => {
    syncPackageProjectFiles(root, defaultsRoot)
    const changes = syncPackageProjectFiles(root, defaultsRoot)

    expect(changes.filter(change => change.path.endsWith(DEFAULTS_SYNC_MARKER))).toEqual([])
    expect(existsSync(markerPath())).toBe(true)
    expect(measureDefaultsDrift(root)).toEqual([])
  })

  it('writes no stamp on a dry run', () => {
    syncPackageProjectFiles(root, defaultsRoot, { dryRun: true })

    expect(existsSync(markerPath())).toBe(false)
  })

  it('measures what a plain dependency bump left behind', () => {
    syncPackageProjectFiles(root, defaultsRoot)

    // What `bun install` does on its own: the package advances, and nothing
    // touches storage/framework/defaults.
    writeDefault('package.json', '{"name":"@stacksjs/defaults","version":"0.70.400"}')
    writeDefault('ai/skills/stacks-buddy/SKILL.md', 'newer skill')

    expect(installedDefaultsVersion(root)).toBe('0.70.400')
    expect(summarizeStructureChanges(measureDefaultsDrift(root) ?? [])).toBe('+0 ~1 -0')
  })

  it('has nothing to measure without an installed package', () => {
    write('storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md', 'old skill')
    rmSync(defaultsRoot, { recursive: true, force: true })

    expect(measureDefaultsDrift(root)).toBeNull()
  })

  it('finds drift by size alone, for the boot-time probe', () => {
    syncPackageProjectFiles(root, defaultsRoot)
    writeDefault('ai/skills/stacks-buddy/SKILL.md', 'a skill of a different length entirely')

    expect(summarizeStructureChanges(measureDefaultsDrift(root, { shallow: true }) ?? [])).toBe('+0 ~1 -0')
  })

  it('does not read contents when probing shallow', () => {
    syncPackageProjectFiles(root, defaultsRoot)
    // Same length, different bytes: a full comparison sees it, sizes do not.
    writeDefault('ai/skills/stacks-buddy/SKILL.md', 'CURRENT SKILL')

    expect(measureDefaultsDrift(root, { shallow: true })).toEqual([])
    expect(summarizeStructureChanges(measureDefaultsDrift(root) ?? [])).toBe('+0 ~1 -0')
  })
})

describe('package project TypeScript migration', () => {
  it('moves the root config off the deleted core config', () => {
    write('tsconfig.json', '{\n  "extends": "./storage/framework/core/tsconfig.json"\n}\n')

    expect(migratePackageProjectTsconfig(root)).toHaveLength(1)
    expect(readFileSync(join(root, 'tsconfig.json'), 'utf8'))
      .toContain('"extends": "./storage/framework/tsconfig.app.json"')
  })
})

describe('AI provider refresh detection', () => {
  it('always seeds AGENTS.md and refreshes providers already in use', () => {
    mkdirSync(join(root, '.claude'), { recursive: true })
    mkdirSync(join(root, '.cursor'), { recursive: true })
    write('GEMINI.md', 'instructions')

    expect(detectProjectAiProviders(root)).toEqual(['codex', 'claude', 'cursor', 'gemini'])
  })
})

describe('Bun pins in CI and containers', () => {
  const workflow = [
    'env:',
    '  BUN_VERSION: 1.3.14',
    'jobs:',
    '  test:',
    '    steps:',
    '      - uses: oven-sh/setup-bun@v2',
    '        with:',
    '          bun-version: ${{ env.BUN_VERSION }}',
    '      - uses: pantry-pm/pantry/packages/action@main',
    '        with:',
    '          packages: bun.sh@1.3.14 bun-plugin-stx@0.2.1',
    '',
  ].join('\n')

  it('raises exact pins and leaves expressions, ranges and other packages alone', () => {
    expect(raiseBunPins(workflow, '1.4.2')).toBe(workflow
      .replace('BUN_VERSION: 1.3.14', 'BUN_VERSION: 1.4.2')
      .replace('bun.sh@1.3.14', 'bun.sh@1.4.2'))
    expect(raiseBunPins('bun-version: "1.3.10"\n', '1.4.2')).toBe('bun-version: "1.4.2"\n')
    expect(raiseBunPins('FROM oven/bun:1.3.14\n', '1.4.2')).toBe('FROM oven/bun:1.4.2\n')
    expect(raiseBunPins('ARG BUN_VERSION=1.3.14\nFROM oven/bun:${BUN_VERSION}-alpine\n', '1.4.2'))
      .toBe('ARG BUN_VERSION=1.4.2\nFROM oven/bun:${BUN_VERSION}-alpine\n')
    expect(raiseBunPins('bun.com: ^1.3.0\n', '1.4.2')).toBe('bun.com: ^1.3.0\n')
  })

  it('never lowers a newer pin', () => {
    expect(raiseBunPins('FROM oven/bun:1.5.0\n', '1.4.2')).toBe('FROM oven/bun:1.5.0\n')
    expect(raiseBunPins('  BUN_VERSION: 1.10.0\n', '1.4.2')).toBe('  BUN_VERSION: 1.10.0\n')
  })

  it('updates workflows and Dockerfiles when the defaults ship a newer Bun', () => {
    write('.github/workflows/ci.yml', workflow)
    write('Dockerfile', 'FROM oven/bun:1.3.14\n')
    write('storage/framework/server/Dockerfile', 'FROM oven/bun:1.3.14\n')
    write('README.md', 'Bun 1.3.14\n')
    writeDefault('project/bun-version', '1.4.2\n')

    const changes = syncPackageProjectFiles(root, defaultsRoot)
    expect(changes.map(change => change.path).filter(path => path.endsWith('Dockerfile') || path.endsWith('.yml')).sort())
      .toEqual(['.github/workflows/ci.yml', 'Dockerfile', 'storage/framework/server/Dockerfile'])
    expect(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')).toContain('BUN_VERSION: 1.4.2')
    expect(readFileSync(join(root, 'Dockerfile'), 'utf8')).toBe('FROM oven/bun:1.4.2\n')
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('Bun 1.3.14\n')
  })

  it('reports without writing on a dry run', () => {
    write('Dockerfile', 'FROM oven/bun:1.3.14\n')
    expect(alignBunPins(root, '1.4.2', [], { dryRun: true })).toEqual([{ path: 'Dockerfile', action: 'update' }])
    expect(readFileSync(join(root, 'Dockerfile'), 'utf8')).toBe('FROM oven/bun:1.3.14\n')
  })
})

describe('vendoring the defaults alone', () => {
  it('copies and stamps the tree, and touches nothing an upgrade would', () => {
    rmSync(join(root, 'storage/framework/defaults'), { recursive: true })
    write('pantry.lock', 'the app\'s lock')

    const changes = vendorDefaultsTree(root, defaultsRoot)

    expect(readFileSync(join(root, 'storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md'), 'utf8')).toBe('current skill')
    expect(existsSync(join(root, 'storage/framework/defaults', DEFAULTS_SYNC_MARKER))).toBe(true)
    expect(changes.every(change => change.path.startsWith('storage/framework/defaults/'))).toBe(true)
    expect(readFileSync(join(root, 'pantry.lock'), 'utf8')).toBe('the app\'s lock')
    expect(existsSync(join(root, 'buddy'))).toBe(false)
  })
})
