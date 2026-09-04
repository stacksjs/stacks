/**
 * Views that arrive with an installed package.
 *
 * The router already registers a discovered package's route files. Those routes
 * had nowhere to render from: view lookup was the application's `resources/views`
 * and the framework defaults, and nothing else, so a package could ship a page
 * and a route to it and the request would 404.
 *
 * The property that makes this safe is positional. stx's `getRoute()` returns
 * the FIRST pattern whose relative path matches, so appending package roots
 * after the existing two cannot change the answer for any path that already
 * resolves. Every assertion below about ordering is really an assertion about
 * that.
 */
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { packageModelRoots, packageViewRoots } from '../src/discovered-resources'
import { resolveViewPatterns } from '../src/views'

function project(): string {
  return mkdtempSync(join(tmpdir(), 'stacks-pkg-views-'))
}

function manifest(root: string, packages: Record<string, unknown>): string {
  const file = join(root, 'discovered-packages.json')
  writeFileSync(file, JSON.stringify({ generated_at: '', packages }, null, 2))
  return file
}

describe('package view roots', () => {
  test('resolves a declared views directory that exists', () => {
    const root = project()
    try {
      mkdirSync(join(root, 'node_modules/loghq/resources/views'), { recursive: true })
      const file = manifest(root, {
        loghq: { root: 'node_modules/loghq', views: ['resources/views'] },
      })

      const roots = packageViewRoots({ manifestPath: file, projectRoot: root })

      expect(roots).toHaveLength(1)
      expect(roots[0]?.package).toBe('loghq')
      expect(roots[0]?.dir).toBe(join(root, 'node_modules/loghq/resources/views'))
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('accepts a single string as well as a list', () => {
    const root = project()
    try {
      mkdirSync(join(root, 'node_modules/loghq/views'), { recursive: true })
      const file = manifest(root, { loghq: { root: 'node_modules/loghq', views: 'views' } })

      expect(packageViewRoots({ manifestPath: file, projectRoot: root })).toHaveLength(1)
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('skips a declared directory that is not on disk', () => {
    const root = project()
    try {
      mkdirSync(join(root, 'node_modules/loghq'), { recursive: true })
      const file = manifest(root, {
        loghq: { root: 'node_modules/loghq', views: ['resources/views'] },
      })

      expect(packageViewRoots({ manifestPath: file, projectRoot: root })).toEqual([])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('refuses a path that escapes the package', () => {
    const root = project()
    try {
      mkdirSync(join(root, 'secrets'), { recursive: true })
      mkdirSync(join(root, 'node_modules/loghq'), { recursive: true })
      const file = manifest(root, {
        loghq: { root: 'node_modules/loghq', views: ['../../secrets'] },
      })

      // A package registering a directory outside itself would serve files the
      // application never installed.
      expect(packageViewRoots({ manifestPath: file, projectRoot: root })).toEqual([])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('a package that declares no views contributes nothing', () => {
    const root = project()
    try {
      const file = manifest(root, { loghq: { root: 'node_modules/loghq' } })
      expect(packageViewRoots({ manifestPath: file, projectRoot: root })).toEqual([])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('a missing or unreadable manifest is no packages, not a failure', () => {
    const root = project()
    try {
      expect(packageViewRoots({ manifestPath: join(root, 'absent.json'), projectRoot: root })).toEqual([])

      const broken = join(root, 'broken.json')
      writeFileSync(broken, '{ not json')
      expect(packageViewRoots({ manifestPath: broken, projectRoot: root })).toEqual([])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('orders by package name, so two packages resolve the same everywhere', () => {
    const root = project()
    try {
      mkdirSync(join(root, 'node_modules/loghq/views'), { recursive: true })
      mkdirSync(join(root, 'node_modules/bughq/views'), { recursive: true })
      const file = manifest(root, {
        loghq: { root: 'node_modules/loghq', views: ['views'] },
        bughq: { root: 'node_modules/bughq', views: ['views'] },
      })

      const roots = packageViewRoots({ manifestPath: file, projectRoot: root })
      expect(roots.map(r => r.package)).toEqual(['bughq', 'loghq'])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})

describe('view patterns with packages installed', () => {
  const pkg = (dir: string) => [{ package: 'loghq', dir }]

  test('package views come last, so nothing that resolves today changes', () => {
    const resolution = resolveViewPatterns(
      'resources/views',
      '/defaults/views',
      undefined,
      () => true,
      pkg('/node_modules/loghq/resources/views'),
    )

    expect(resolution.patterns).toEqual([
      'resources/views',
      '/defaults/views',
      '/node_modules/loghq/resources/views',
    ])
  })

  test('an app that turned the framework defaults off still gets package views', () => {
    // `defaultViews: false` is about the framework's demo pages. It says
    // nothing about a package the application chose to install.
    const resolution = resolveViewPatterns(
      'resources/views',
      '/defaults/views',
      false,
      () => true,
      pkg('/node_modules/loghq/resources/views'),
    )

    expect(resolution.patterns).toEqual([
      'resources/views',
      '/node_modules/loghq/resources/views',
    ])
  })

  test('package views append after a selected subtree list', () => {
    const resolution = resolveViewPatterns(
      'resources/views',
      '/defaults/views',
      ['errors'],
      () => true,
      pkg('/node_modules/loghq/resources/views'),
    )

    expect(resolution.patterns).toEqual([
      'resources/views',
      '/defaults/views/errors',
      '/node_modules/loghq/resources/views',
    ])
    expect(resolution.missing).toEqual([])
  })

  test('no packages resolves exactly what it resolved before', () => {
    for (const setting of [undefined, true, false, ['errors']] as const) {
      const before = resolveViewPatterns('resources/views', '/defaults/views', setting, () => true, [])
      const expected = setting === false
        ? ['resources/views']
        : Array.isArray(setting)
          ? ['resources/views', '/defaults/views/errors']
          : ['resources/views', '/defaults/views']

      expect(before.patterns).toEqual(expected)
    }
  })
})

describe('package model roots', () => {
  test('a package that ships app/Models is found without declaring anything', () => {
    const root = project()
    try {
      mkdirSync(join(root, 'node_modules/loghq/app/Models'), { recursive: true })
      // No `models` key: models have no manifest field, so a package is taken
      // to put them where every Stacks application does.
      const file = manifest(root, { loghq: { root: 'node_modules/loghq' } })

      const roots = packageModelRoots({ manifestPath: file, projectRoot: root })

      expect(roots).toHaveLength(1)
      expect(roots[0]?.dir).toBe(join(root, 'node_modules/loghq/app/Models'))
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('a package with no models directory contributes nothing', () => {
    const root = project()
    try {
      mkdirSync(join(root, 'node_modules/table/resources'), { recursive: true })
      const file = manifest(root, { table: { root: 'node_modules/table' } })

      expect(packageModelRoots({ manifestPath: file, projectRoot: root })).toEqual([])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })

  test('models and views are resolved independently of one another', () => {
    const root = project()
    try {
      mkdirSync(join(root, 'node_modules/loghq/app/Models'), { recursive: true })
      mkdirSync(join(root, 'node_modules/loghq/resources/views'), { recursive: true })
      const file = manifest(root, {
        loghq: { root: 'node_modules/loghq', views: ['resources/views'] },
      })

      const opts = { manifestPath: file, projectRoot: root }
      expect(packageModelRoots(opts).map(r => r.dir)).toEqual([join(root, 'node_modules/loghq/app/Models')])
      expect(packageViewRoots(opts).map(r => r.dir)).toEqual([join(root, 'node_modules/loghq/resources/views')])
    }
    finally { rmSync(root, { recursive: true, force: true }) }
  })
})
