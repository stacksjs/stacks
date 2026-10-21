import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  DEFAULT_TOGGLES,
  DISCOVERED_MANIFEST_PATH,
  LEGACY_DISCOVERED_MANIFEST_PATH,
  buildNavSections,
  buildWebSidebarSections,
  loadDiscoveredManifest,
  parseDiscoveredManifest,
} from '../../storage/framework/defaults/resources/functions/dashboard/sidebar'

describe('dashboard sidebar data', () => {
  it('maps discovered models through native sidebar metadata', () => {
    const sections = buildNavSections([
      {
        id: 'audit-log',
        name: 'AuditLog',
        category: 'data',
        dashboard: {
          label: 'Audit Trail',
          icon: 'log',
          roles: ['admin'],
        },
      },
    ])
    const dataItems = sections.find(([id]) => id === 'data')?.[2] ?? []
    const auditItem = dataItems.find(item => item.to === '/models/audit-log')

    expect(auditItem).toEqual({
      to: '/models/audit-log',
      icon: 'log',
      text: 'Audit Trail',
      roles: ['admin'],
    })
  })

  it('returns component data without serialized markup', () => {
    const sections = buildWebSidebarSections()
    const serialized = JSON.stringify(sections)

    expect(sections[0]?.items[0]?.href).toBe('/')
    expect(serialized).not.toContain('<svg')
    expect(serialized).not.toContain('onclick=')
    expect(serialized).not.toContain('sidebar-link')
  })

  // Settings used to be listed twice: once in Utilities beside Appearance and
  // Mail Settings, and again in a trailing unlabelled section that pinned it
  // to the bottom the way macOS does. Two rows, two clicks apart, same page.
  it('lists Settings once, in Utilities', () => {
    const sections = buildWebSidebarSections()
    const settings = sections.flatMap(section =>
      section.items.filter(item => item.href === '/settings').map(item => [section.id, item.label] as const),
    )

    expect(settings).toEqual([['utilities', 'Settings']])
  })

  it('links the component library through its non-conflicting route', () => {
    const library = buildNavSections().find(([id]) => id === 'library')?.[2] ?? []

    expect(library).toContainEqual({
      to: '/library/components',
      icon: 'layout-table-01',
      text: 'Components',
    })
    expect(library.some(item => item.to === '/components')).toBe(false)
  })

  it('makes the persisted analytics overview directly navigable', () => {
    const analytics = buildNavSections().find(([id]) => id === 'analytics')?.[2] ?? []

    expect(analytics[0]).toEqual({
      to: '/analytics',
      icon: 'dashboard',
      text: 'Overview',
    })
  })

  it('gates optional CI navigation to dev-capable viewers', () => {
    const management = buildNavSections([], { ...DEFAULT_TOGGLES, ci: true })
      .find(([id]) => id === 'management')?.[2] ?? []

    expect(management).toContainEqual({
      to: '/ci',
      icon: 'check-circle',
      text: 'CI',
      roles: ['dev'],
    })
  })

  it('deeply defaults unspecified manifest data toggles', () => {
    const manifest = parseDiscoveredManifest(JSON.stringify({
      models: [],
      sections: {
        data: {
          subscribers: false,
        },
      },
    }))

    expect(manifest.sections.data).toEqual({
      dashboard: true,
      activity: true,
      users: true,
      teams: true,
      subscribers: false,
      allModels: true,
    })
  })

  it('reports malformed generated manifests', () => {
    expect(() => parseDiscoveredManifest('{')).toThrow('invalid JSON')
    expect(() => parseDiscoveredManifest(JSON.stringify([]))).toThrow('manifest must be an object')
    expect(() => parseDiscoveredManifest(JSON.stringify({
      models: [],
      sections: { library: 'false' },
    }))).toThrow('manifest sections.library must be a boolean')
  })
})

/**
 * The manifest is generated per app from its own models and its
 * `config/dashboard.ts` section toggles. It used to be written into
 * `storage/framework/defaults/`, which is the vendored framework tree and is
 * tracked, so every app that ran `buddy dev --dashboard` dirtied a file it
 * does not own, and flipping a dashboard section toggle rewrote it.
 */
describe('discovered-models manifest location', () => {
  const payload = JSON.stringify({
    models: [{ id: 'users', name: 'User' }],
    sections: DEFAULT_TOGGLES,
    nav: [],
  })

  /** A throwaway project root with a manifest at `rel`. */
  function project(rel: string | null): string {
    const dir = mkdtempSync(join(tmpdir(), 'sidebar-manifest-'))
    if (rel !== null) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true })
      writeFileSync(join(dir, rel), payload)
    }
    return dir
  }

  function loadFrom(dir: string): ReturnType<typeof loadDiscoveredManifest> {
    const cwd = process.cwd()
    process.chdir(dir)
    try {
      return loadDiscoveredManifest()
    }
    finally {
      process.chdir(cwd)
    }
  }

  it('writes and reads under storage/framework/runtime, which is gitignored', () => {
    expect(DISCOVERED_MANIFEST_PATH).toBe('storage/framework/runtime/dashboard/.discovered-models.json')
    expect(DISCOVERED_MANIFEST_PATH.startsWith('storage/framework/runtime/')).toBe(true)

    const dir = project(DISCOVERED_MANIFEST_PATH)
    try {
      expect(loadFrom(dir).models).toEqual([{ id: 'users', name: 'User' }])
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('still reads the legacy defaults path, so an upgrade keeps its sidebar', () => {
    const dir = project(LEGACY_DISCOVERED_MANIFEST_PATH)
    try {
      expect(loadFrom(dir).models).toEqual([{ id: 'users', name: 'User' }])
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prefers the runtime path when both exist', () => {
    const dir = project(DISCOVERED_MANIFEST_PATH)
    try {
      mkdirSync(dirname(join(dir, LEGACY_DISCOVERED_MANIFEST_PATH)), { recursive: true })
      writeFileSync(
        join(dir, LEGACY_DISCOVERED_MANIFEST_PATH),
        JSON.stringify({ models: [{ id: 'stale', name: 'Stale' }], sections: DEFAULT_TOGGLES, nav: [] }),
      )
      expect(loadFrom(dir).models).toEqual([{ id: 'users', name: 'User' }])
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to an empty payload when neither path has one', () => {
    const dir = project(null)
    try {
      const manifest = loadFrom(dir)
      expect(manifest.models).toEqual([])
      expect(manifest.sections).toEqual(DEFAULT_TOGGLES)
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
