// `buddy publish:component` and `buddy publish:view` (stacksjs/stacks#3032).
//
// A published template is only worth having if a server reads it and its
// imports still resolve. Both are checked here: the lookup puts the copy where
// the app's copy is read and refuses the trees no server reads one from, and
// the import rewrite is run over every default template that has relative
// imports, against the real tree.

import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { globSync } from '@stacksjs/storage'
import { COMPONENT_TREE, locateDefaultStx, pointImportsAtDefaults, VIEW_TREES } from '../src/publish-stx'

const DEFAULTS = join(import.meta.dir, '../../../defaults')

function fixture(files: string[]): { defaults: string, project: string, cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), 'stacks-publish-stx-'))
  const defaults = join(root, 'storage/framework/defaults')
  for (const file of files) {
    mkdirSync(dirname(join(defaults, file)), { recursive: true })
    writeFileSync(join(defaults, file), `<div>${file}</div>\n`)
  }
  return { defaults, project: root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

describe('publish:component', () => {
  test('lands at the same path under resources/components, found by name', () => {
    const { defaults, project, cleanup } = fixture(['resources/components/Storefront/ProductCard.stx'])
    try {
      const found = locateDefaultStx('component', 'ProductCard', defaults, project)
      expect(found).toEqual({
        ok: true,
        source: join(defaults, 'resources/components/Storefront/ProductCard.stx'),
        target: join(project, 'resources/components/Storefront/ProductCard.stx'),
      })
    }
    finally {
      cleanup()
    }
  })

  test('asks for the path when two defaults share a name, and takes it', () => {
    const { defaults, project, cleanup } = fixture([
      'resources/components/Forum/Avatar.stx',
      'resources/components/Storefront/Avatar.stx',
    ])
    try {
      const ambiguous = locateDefaultStx('component', 'Avatar', defaults, project)
      expect(ambiguous.ok).toBeFalse()
      if (!ambiguous.ok)
        expect(ambiguous.details).toEqual(['buddy publish:component Forum/Avatar', 'buddy publish:component Storefront/Avatar'])

      const chosen = locateDefaultStx('component', 'Storefront/Avatar.stx', defaults, project)
      expect(chosen.ok && chosen.target).toBe(join(project, 'resources/components/Storefront/Avatar.stx'))
    }
    finally {
      cleanup()
    }
  })

  test('a name that is also a top-level path means that file, so it is never ambiguous with itself', () => {
    const { defaults, project, cleanup } = fixture([
      'resources/components/Pagination.stx',
      'resources/components/Storefront/Pagination.stx',
    ])
    try {
      const found = locateDefaultStx('component', 'Pagination', defaults, project)
      expect(found.ok && found.source).toBe(join(defaults, 'resources/components/Pagination.stx'))
    }
    finally {
      cleanup()
    }
  })

  test('refuses the trees whose app copy no server reads', () => {
    const { defaults, project, cleanup } = fixture(['resources/components/Email/EmailLayout.stx'])
    try {
      const found = locateDefaultStx('component', 'EmailLayout', defaults, project)
      expect(found.ok).toBeFalse()
      if (!found.ok)
        expect(found.message).toContain('cannot be overridden from the app')
    }
    finally {
      cleanup()
    }
  })

  test('publishes a dashboard component where the dashboard servers now read it first', () => {
    const { defaults, project, cleanup } = fixture(['resources/components/Dashboard/Commerce/CommerceOrdersTable.stx'])
    try {
      const found = locateDefaultStx('component', 'CommerceOrdersTable', defaults, project)
      expect(found.ok && found.target).toBe(join(project, 'resources/components/Dashboard/Commerce/CommerceOrdersTable.stx'))
    }
    finally {
      cleanup()
    }
  })

  test('rejects a name that climbs out of the tree', () => {
    const { defaults, project, cleanup } = fixture([])
    try {
      expect(locateDefaultStx('component', '../../app/Models/User', defaults, project).ok).toBeFalse()
    }
    finally {
      cleanup()
    }
  })
})

describe('publish:view', () => {
  const files = [
    'resources/views/login.stx',
    'resources/views/dashboard/index.stx',
    'resources/views/checkout/index.stx',
    'views/dashboard/index.stx',
    'views/dashboard/commerce/orders.stx',
    'views/dashboard/layouts/default.stx',
  ]

  test('names a view by its path under resources/views', () => {
    const { defaults, project, cleanup } = fixture(files)
    try {
      const cases: Array<[string, string, string]> = [
        ['login', 'resources/views/login.stx', 'resources/views/login.stx'],
        ['checkout', 'resources/views/checkout/index.stx', 'resources/views/checkout/index.stx'],
        ['dashboard/commerce/orders', 'views/dashboard/commerce/orders.stx', 'resources/views/dashboard/commerce/orders.stx'],
      ]
      for (const [name, from, to] of cases)
        expect(locateDefaultStx('view', name, defaults, project)).toEqual({ ok: true, source: join(defaults, from), target: join(project, to) })
    }
    finally {
      cleanup()
    }
  })

  test('dashboard/ means the dashboard page, which the dashboard server reads first', () => {
    const { defaults, project, cleanup } = fixture(files)
    try {
      for (const name of ['dashboard', 'dashboard/index']) {
        const found = locateDefaultStx('view', name, defaults, project)
        expect(found.ok && found.source).toBe(join(defaults, 'views/dashboard/index.stx'))
      }
    }
    finally {
      cleanup()
    }
  })

  test('refuses the dashboard layouts, which only the framework\'s are read for', () => {
    const { defaults, project, cleanup } = fixture(files)
    try {
      expect(locateDefaultStx('view', 'dashboard/layouts/default', defaults, project).ok).toBeFalse()
    }
    finally {
      cleanup()
    }
  })
})

describe('against the real defaults tree', () => {
  test('every refused subtree still exists, so the refusal list is not stale', () => {
    expect(Object.keys(COMPONENT_TREE.frameworkOnly ?? {}).length).toBeGreaterThan(0)
    for (const segment of Object.keys(COMPONENT_TREE.frameworkOnly ?? {}))
      expect(existsSync(join(DEFAULTS, COMPONENT_TREE.from, segment))).toBeTrue()
    for (const tree of VIEW_TREES) {
      for (const segment of Object.keys(tree.frameworkOnly ?? {}))
        expect(existsSync(join(DEFAULTS, tree.from, segment))).toBeTrue()
    }
  })

  test('every relative import in a default template is pointed at a file @stacksjs/defaults has', () => {
    const templates = globSync(['resources/components/**/*.stx', 'resources/views/**/*.stx', 'views/dashboard/**/*.stx'], { cwd: DEFAULTS, absolute: true })
    let checked = 0

    for (const file of templates) {
      const source = readFileSync(file, 'utf8')
      if (!/from\s+['"]\.{1,2}\//.test(source))
        continue

      const { code, rewritten } = pointImportsAtDefaults(source, file, DEFAULTS)
      expect(rewritten).toBeGreaterThan(0)
      expect(code).not.toMatch(/from\s+['"]\.{1,2}\//)

      for (const [, specifier] of code.matchAll(/from\s+['"]@stacksjs\/defaults\/([^'"]+)['"]/g)) {
        const target = join(DEFAULTS, specifier!)
        expect(existsSync(target) || existsSync(`${target}.ts`) || existsSync(`${target}/index.ts`)).toBeTrue()
      }
      checked++
    }

    // The defaults lean on relative imports heavily; zero would mean the scan
    // found nothing and the loop above proved nothing.
    expect(checked).toBeGreaterThan(50)
  })
})
