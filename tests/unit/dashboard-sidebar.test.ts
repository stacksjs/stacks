import { describe, expect, it } from 'bun:test'
import {
  buildNavSections,
  buildWebSidebarSections,
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
})
