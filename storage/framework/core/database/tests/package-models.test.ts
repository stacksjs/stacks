/**
 * Models that arrive with an installed package.
 *
 * A package declaring a `stacks` key can already ship routes, which the router
 * registers from the package's own directory. Models were the gap: the
 * generator read `app/Models` and the framework defaults and nothing else, so
 * `bun add loghq` brought LogHQ's routes and none of the tables they query.
 *
 * Two properties matter more than the merge itself.
 *
 * An application with no packages must resolve exactly what it resolved
 * before, including the fallback that makes the framework defaults stand in
 * only when userland has no models of its own (stacksjs/stacks#2220).
 *
 * And a name collision has to stop the run. Models become server globals, so
 * two of the same name are not a conflict precedence can settle: whichever
 * loses is gone, and the table it owned is described by nothing.
 */
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveModelSources } from '../src/model-sources'
import { packageModelRoots } from '../src/package-models'

/** A throwaway project tree. Every test gets its own. */
function project(): string {
  return mkdtempSync(join(tmpdir(), 'stacks-pkg-models-'))
}

/** Write model files into a directory, returning it. */
function models(dir: string, names: string[]): string {
  mkdirSync(dir, { recursive: true })
  for (const name of names) {
    writeFileSync(
      join(dir, `${name}.ts`),
      `export default defineModel({ name: '${name}' })\n`,
    )
  }
  return dir
}

function manifest(root: string, packages: Record<string, { root: string }>): string {
  const file = join(root, 'discovered-packages.json')
  writeFileSync(file, JSON.stringify({ generated_at: '', packages }, null, 2))
  return file
}

describe('package model roots', () => {
  test('resolves a discovered package that ships models', () => {
    const root = project()
    try {
      models(join(root, 'node_modules/loghq/app/Models'), ['LogEntry'])
      const file = manifest(root, { loghq: { root: 'node_modules/loghq' } })

      const roots = packageModelRoots({ manifestPath: file, projectRoot: root })

      expect(roots).toHaveLength(1)
      expect(roots[0]?.package).toBe('loghq')
      expect(roots[0]?.dir).toBe(join(root, 'node_modules/loghq/app/Models'))
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('skips a discovered package that ships no models', () => {
    const root = project()
    try {
      mkdirSync(join(root, 'node_modules/table'), { recursive: true })
      const file = manifest(root, { table: { root: 'node_modules/table' } })

      expect(packageModelRoots({ manifestPath: file, projectRoot: root })).toEqual([])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('a missing manifest is no packages, not a failure', () => {
    const root = project()
    try {
      const roots = packageModelRoots({
        manifestPath: join(root, 'nothing-here.json'),
        projectRoot: root,
      })
      expect(roots).toEqual([])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('an unreadable manifest degrades rather than aborting a generate', () => {
    const root = project()
    try {
      const file = join(root, 'broken.json')
      writeFileSync(file, '{ not json')

      expect(packageModelRoots({ manifestPath: file, projectRoot: root })).toEqual([])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})

describe('resolving models with packages installed', () => {
  test('a package model stays OUT of the generator scope, and its table is protected', () => {
    const root = project()
    try {
      const userRoot = models(join(root, 'app/Models'), ['Post'])
      const frameworkRoot = models(join(root, 'defaults/Models'), ['User'])
      const pkg = models(join(root, 'node_modules/loghq/app/Models'), ['LogEntry'])

      const resolved = resolveModelSources({
        userRoot,
        frameworkRoot,
        packageRoots: [{ package: 'loghq', dir: pkg }],
      })

      // The package owns log_entries through the SQL it ships, so generating a
      // second CREATE TABLE for it would produce a duplicate that the pruning
      // resolves by deleting a file, possibly the package's own.
      expect(resolved?.models.map(m => m.name).sort()).toEqual(['Post'])

      // But the generator must know the table exists, or it proposes a DROP.
      expect(resolved?.excludedTables).toContain('log_entries')
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('a userland model of the same name is the one that generates', () => {
    const root = project()
    try {
      const userRoot = models(join(root, 'app/Models'), ['LogEntry'])
      const frameworkRoot = models(join(root, 'defaults/Models'), ['User'])
      const pkg = models(join(root, 'node_modules/loghq/app/Models'), ['LogEntry'])

      const resolved = resolveModelSources({
        userRoot,
        frameworkRoot,
        packageRoots: [{ package: 'loghq', dir: pkg }],
      })

      const entry = resolved?.models.find(m => m.name === 'LogEntry')
      expect(entry?.origin).toBe('user')
      expect(entry?.file.startsWith(userRoot)).toBe(true)
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('the framework fallback still turns on for an app with no models of its own', () => {
    const root = project()
    try {
      const userRoot = join(root, 'app/Models')
      const frameworkRoot = models(join(root, 'defaults/Models'), ['User'])
      const pkg = models(join(root, 'node_modules/loghq/app/Models'), ['LogEntry'])

      const resolved = resolveModelSources({
        userRoot,
        frameworkRoot,
        packageRoots: [{ package: 'loghq', dir: pkg }],
      })

      // A package bringing models is not the app having models of its own, so
      // the defaults still stand in. Removing them here would take User away
      // from a fresh app the moment it installed anything.
      expect(resolved?.models.map(m => m.name).sort()).toEqual(['User'])
      expect(resolved?.excludedTables).toContain('log_entries')
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('two packages shipping the same model name stop the run', () => {
    const root = project()
    try {
      const userRoot = models(join(root, 'app/Models'), ['Post'])
      const frameworkRoot = models(join(root, 'defaults/Models'), ['User'])
      const loghq = models(join(root, 'node_modules/loghq/app/Models'), ['Project'])
      const bughq = models(join(root, 'node_modules/bughq/app/Models'), ['Project'])

      expect(() => resolveModelSources({
        userRoot,
        frameworkRoot,
        packageRoots: [
          { package: 'loghq', dir: loghq },
          { package: 'bughq', dir: bughq },
        ],
      })).toThrow(/both ship a 'Project' model/)
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('a package shipping a framework model stops the run, which is the User rule', () => {
    const root = project()
    try {
      const userRoot = models(join(root, 'app/Models'), ['Post'])
      const frameworkRoot = models(join(root, 'defaults/Models'), ['User'])
      const pkg = models(join(root, 'node_modules/loghq/app/Models'), ['User'])

      expect(() => resolveModelSources({
        userRoot,
        frameworkRoot,
        packageRoots: [{ package: 'loghq', dir: pkg }],
      })).toThrow(/never ships its own User/)
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('no packages resolves exactly what it resolved before', () => {
    const root = project()
    try {
      const userRoot = models(join(root, 'app/Models'), ['Post', 'Comment'])
      const frameworkRoot = models(join(root, 'defaults/Models'), ['User'])

      const before = resolveModelSources({ userRoot, frameworkRoot, packageRoots: [] })

      expect(before?.models.map(m => m.name).sort()).toEqual(['Comment', 'Post'])
      expect(before?.models.every(m => m.origin === 'user')).toBe(true)
      expect(before?.excluded.map(m => m.name)).toEqual(['User'])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})
