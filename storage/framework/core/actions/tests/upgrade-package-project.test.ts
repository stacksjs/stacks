import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULTS_SYNC_MARKER,
  detectProjectAiProviders,
  inspectDefaultsProvenance,
  installedDefaultsVersion,
  measureDefaultsDrift,
  migratePackageProjectManifest,
  migratePackageProjectTsconfig,
  summarizeStructureChanges,
  syncPackageProjectFiles,
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
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('package project manifest migration', () => {
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
    expect(pkg.scripts.typecheck).toContain('-p tsconfig.json')
    expect(pkg.scripts['build:framework-types']).toBeUndefined()
    expect(pkg.workspaces).toEqual(['storage/framework'])
  })
})

describe('package project file sync', () => {
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
    expect(existsSync(join(root, 'storage/framework/defaults'))).toBe(false)
    expect(existsSync(join(root, 'buddy'))).toBe(false)
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

  it('reports a synced tree as current', () => {
    syncPackageProjectFiles(root, defaultsRoot)

    expect(inspectDefaultsProvenance(root)).toMatchObject({
      status: 'current',
      installed: '0.70.362',
      vendored: '0.70.362',
    })
  })

  it('reports a tree left behind by a plain dependency bump as stale', () => {
    syncPackageProjectFiles(root, defaultsRoot)

    // What `bun install` does on its own: the package advances, and nothing
    // touches storage/framework/defaults.
    writeDefault('package.json', '{"name":"@stacksjs/defaults","version":"0.70.400"}')
    writeDefault('ai/skills/stacks-buddy/SKILL.md', 'newer skill')

    expect(inspectDefaultsProvenance(root)).toMatchObject({
      status: 'stale',
      installed: '0.70.400',
      vendored: '0.70.362',
    })
    expect(summarizeStructureChanges(measureDefaultsDrift(root) ?? [])).toBe('+0 ~1 -0')
  })

  it('reports a tree written before stamping existed as unstamped', () => {
    syncPackageProjectFiles(root, defaultsRoot)
    rmSync(markerPath())

    expect(inspectDefaultsProvenance(root)).toMatchObject({
      status: 'unstamped',
      installed: '0.70.362',
      vendored: null,
    })
  })

  it('has nothing to compare without an installed package', () => {
    write('storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md', 'old skill')
    rmSync(defaultsRoot, { recursive: true, force: true })

    expect(inspectDefaultsProvenance(root).status).toBe('not-applicable')
    expect(measureDefaultsDrift(root)).toBeNull()
  })

  it('stays quiet in a framework checkout, where the tree is the source', () => {
    syncPackageProjectFiles(root, defaultsRoot)
    write('storage/framework/core/buddy/package.json', '{"name":"@stacksjs/buddy"}')
    writeDefault('package.json', '{"name":"@stacksjs/defaults","version":"0.70.400"}')

    expect(inspectDefaultsProvenance(root).status).toBe('not-applicable')
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
