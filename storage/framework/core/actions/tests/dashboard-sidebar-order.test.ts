import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emptySidebarOrder, orderSidebarSections, parseSidebarOrder, sidebarGroupKey } from '../../../defaults/resources/functions/dashboard/sidebar-order'
import { readSidebarOrder, sidebarOrderPath, writeSidebarOrder } from '../../../defaults/app/Actions/Dashboard/Settings/sidebar-order-store'
import { filterSchemaNavSections } from '../../../defaults/resources/functions/dashboard/sidebar'

const sections = [
  { id: 'data', label: 'Data', items: [
    { id: 'users', label: 'Users', icon: 'i-lucide-users', iconColor: 'blue' },
    { id: 'more', label: 'More models', icon: '', iconColor: 'blue', children: [
      { id: 'bookings', label: 'Bookings', icon: '', iconColor: 'blue' },
      { id: 'classes', label: 'Classes', icon: '', iconColor: 'blue' },
    ] },
  ] },
  { id: 'management', label: 'Management', items: [] },
]

test('local sidebar order survives a new reader without changing the team defaults', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-sidebar-order-'))
  try {
    const options = { configHome: directory, projectRoot: directory, viewer: 'local' }
    const original = JSON.stringify(sections)
    const order = { ...emptySidebarOrder(), sections: ['management', 'data'], items: {
      [sidebarGroupKey('data')]: ['more', 'users'],
      [sidebarGroupKey('data', ['more'])]: ['classes', 'bookings'],
    } }
    await writeSidebarOrder(order, options)
    const saved = await readSidebarOrder(options)
    const displayed = orderSidebarSections(sections, saved.order)
    expect(displayed.map(section => section.id)).toEqual(['management', 'data'])
    expect(displayed[1]!.items.map(item => item.id)).toEqual(['more', 'users'])
    expect(displayed[1]!.items[0]!.children!.map(item => item.id)).toEqual(['classes', 'bookings'])
    expect(JSON.stringify(sections)).toBe(original)
    expect(JSON.parse(await readFile(sidebarOrderPath(options), 'utf8'))).toEqual(order)
    expect(sidebarOrderPath({ ...options, viewer: 'user:123' })).not.toBe(sidebarOrderPath(options))
    expect((await stat(sidebarOrderPath(options))).mode & 0o777).toBe(0o600)
    await writeSidebarOrder(emptySidebarOrder(), options)
    expect(orderSidebarSections(sections, (await readSidebarOrder(options)).order)).toEqual(sections)
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})

test('team changes preserve access, groups and new rows while honoring known personal identifiers', () => {
  const order = { ...emptySidebarOrder(), sections: ['removed-section', 'management', 'data'], items: {
    [sidebarGroupKey('data')]: ['removed', 'more', 'classes', 'users'],
    [sidebarGroupKey('data', ['more'])]: ['classes', 'removed', 'bookings'],
  } }
  const team = structuredClone(sections)
  team[0]!.items.push({ id: 'athletes', label: 'Athletes', icon: '', iconColor: 'blue' })
  const displayed = orderSidebarSections(team, order)
  expect(displayed.map(section => section.id)).toEqual(['management', 'data'])
  expect(displayed[1]!.items.map(item => item.id)).toEqual(['more', 'users', 'athletes'])
  expect(displayed[1]!.items[0]!.children!.map(item => item.id)).toEqual(['classes', 'bookings'])
  expect(displayed[1]!.items[0]!.children![0]!.label).toBe('Classes')
})

test('optional mail and schema destinations stay out of built-in navigation without hiding application-defined links', () => {
  const row = (to: string) => ({ to, text: to, icon: 'mail' })
  const input: Parameters<typeof filterSchemaNavSections>[0] = [
    ['app', 'App', ['/inbox', '/inbox/activity', '/inbox/captured', '/inbox/settings', '/data/teams'].map(row)],
    ['app-nav-0', 'Custom', [row('/inbox')]],
  ]
  expect(filterSchemaNavSections(input, [], { inbox: false })[0]![2].map(item => item.to)).toEqual(['/inbox/captured'])
  expect(filterSchemaNavSections(input, [], { inbox: false })[1]![2].map(item => item.to)).toEqual(['/inbox'])
  expect(filterSchemaNavSections(input, ['MailPreference', 'Team'], { inbox: true })[0]![2]).toHaveLength(5)
  expect(filterSchemaNavSections(input, undefined, { inbox: false })[0]![2].map(item => item.to)).toEqual(['/inbox/captured', '/inbox/settings', '/data/teams'])
})

test('malformed or excessive preference payloads cannot become filesystem paths or corrupt a saved order', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stacks-sidebar-order-invalid-'))
  try {
    const options = { projectRoot: directory, configHome: directory }
    const good = { ...emptySidebarOrder(), sections: ['data'] }
    await writeSidebarOrder(good, options)
    for (const value of [null, {}, { ...good, version: 2 }, { ...good, sections: ['data', 'data'] }, { ...good, items: { '../../source': ['users'] } }, { ...good, sections: [7] }, { ...good, sections: ['a'.repeat(257)] }]) {
      expect(() => parseSidebarOrder(value)).toThrow(TypeError)
      await expect(writeSidebarOrder(value, options)).rejects.toThrow(TypeError)
    }
    expect((await readSidebarOrder(options)).order).toEqual(good)
    const another = join(directory, 'another-project')
    await mkdir(another)
    expect((await readSidebarOrder({ ...options, projectRoot: another })).order).toEqual(emptySidebarOrder())
    await writeFile(sidebarOrderPath(options), '{broken')
    expect((await readSidebarOrder(options)).warning).toContain('invalid')
    expect((await readSidebarOrder(options)).order).toEqual(emptySidebarOrder())
    expect(await readFile(sidebarOrderPath(options), 'utf8')).toBe('{broken')
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})
