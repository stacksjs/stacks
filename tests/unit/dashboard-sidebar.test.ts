import { describe, expect, it } from 'bun:test'
import {
  buildNavSections,
  buildWebSidebarSections,
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
    expect(sections.at(-1)?.items[0]?.href).toBe('/settings')
    expect(serialized).not.toContain('<svg')
    expect(serialized).not.toContain('onclick=')
    expect(serialized).not.toContain('sidebar-link')
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
