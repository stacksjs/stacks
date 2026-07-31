import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('dashboard home component', () => {
  test('keeps the route view thin and componentized', () => {
    const view = source('storage/framework/defaults/views/dashboard/index.stx')

    expect(view).toContain('<DashboardHome />')
    expect(view).not.toContain('<script')
    expect(view).not.toContain('dashboardApi')
  })

  test('renders only canonical persisted home data', () => {
    const home = source('storage/framework/defaults/resources/components/Dashboard/Home/DashboardHome.stx')

    expect(home).toContain("import { useDashboard }")
    expect(home).toContain('<StatsCard')
    expect(home).toContain('<ServiceHealth')
    expect(home).toContain('<ActivityTable')
    expect(home).toContain('<QuickLinks')
    expect(home).toContain('<Button')
    expect(home).not.toContain("value: '0'")
    expect(home).not.toContain("value: '$0'")
    expect(home).not.toContain("status: 'healthy'")
  })

  test('keeps home primitives reactive across component boundaries', () => {
    const health = source('storage/framework/defaults/resources/components/Dashboard/UI/ServiceHealth.stx')
    const activity = source('storage/framework/defaults/resources/components/Dashboard/UI/ActivityTable.stx')
    const links = source('storage/framework/defaults/resources/components/Dashboard/UI/QuickLinks.stx')

    expect(health).toContain("const services = useReactiveProp('services'")
    expect(health).toContain("const loading = useReactiveProp('loading'")
    expect(activity).toContain("const activities = useReactiveProp('activities'")
    expect(activity).toContain("const loading = useReactiveProp('loading'")
    expect(links).toContain("const links = useReactiveProp('links'")
    expect(links).toContain("const customClass = useReactiveProp('class'")
  })
})
