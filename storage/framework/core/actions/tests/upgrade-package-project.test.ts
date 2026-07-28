import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  detectProjectAiProviders,
  migratePackageProjectManifest,
  migratePackageProjectTsconfig,
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
  writeDefault('package.json', '{"name":"@stacksjs/defaults"}')
  writeDefault('ai/skills/stacks-buddy/SKILL.md', 'current skill')
  writeDefault('project/buddy', '#!/bin/sh\n')
  writeDefault('project/bootstrap', '#!/bin/sh\n')
  writeDefault('project/storage/framework/tsconfig.app.json', '{"app":true}\n')
  writeDefault('project/storage/framework/tsconfig.base.json', '{"base":true}\n')
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

    const changes = syncPackageProjectFiles(root, defaultsRoot)

    expect(changes.some(change => change.path === 'storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md')).toBe(true)
    expect(readFileSync(join(root, 'storage/framework/defaults/ai/skills/stacks-buddy/SKILL.md'), 'utf8')).toBe('current skill')
    expect(existsSync(join(root, 'storage/framework/defaults/ai/skills/removed'))).toBe(false)
    expect(existsSync(join(root, 'storage/framework/defaults/.discovered-models.json'))).toBe(true)
    expect(readFileSync(join(root, 'storage/framework/tsconfig.app.json'), 'utf8')).toContain('"app"')
    expect(lstatSync(join(root, 'buddy')).mode & 0o111).not.toBe(0)
  })

  it('reports a dry run without writing any project files', () => {
    const changes = syncPackageProjectFiles(root, defaultsRoot, { dryRun: true })

    expect(changes.length).toBeGreaterThan(0)
    expect(existsSync(join(root, 'storage/framework/defaults'))).toBe(false)
    expect(existsSync(join(root, 'buddy'))).toBe(false)
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
