import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  dashboardBackendWatchRoots,
  isDashboardBackendSource,
} from '../../storage/framework/core/actions/src/dev/dashboard-supervisor'

describe('dashboard backend reload contract', () => {
  test('watches application, framework action, and core source roots', () => {
    const roots = dashboardBackendWatchRoots().map(root => resolve(root))

    expect(roots).toContain(resolve('app'))
    expect(roots).toContain(resolve('routes'))
    expect(roots).toContain(resolve('config'))
    expect(roots).toContain(resolve('storage/framework/defaults/app'))
    expect(roots).toContain(resolve('storage/framework/core/auth/src'))
    expect(roots.some(root => root.includes('/dist'))).toBeFalse()
  })

  test('restarts for runtime source without taking over STX template HMR', () => {
    expect(isDashboardBackendSource('Actions/Dashboard/IndexAction.ts')).toBeTrue()
    expect(isDashboardBackendSource('config/dashboard.json')).toBeTrue()
    expect(isDashboardBackendSource('components/Dashboard.stx')).toBeFalse()
    expect(isDashboardBackendSource('types/dashboard.d.ts')).toBeFalse()
  })

  test('runs the long-lived STX server only inside the supervised worker', () => {
    const source = readFileSync(
      resolve('storage/framework/core/actions/src/dev/dashboard.ts'),
      'utf8',
    )

    expect(source).toContain("process.env.STACKS_DASHBOARD_WORKER !== '1'")
    expect(source).toContain('runDashboardSupervisor(import.meta.path, process.argv.slice(2))')
  })

  test('pins the STX template root for app and dashboard serving', () => {
    const dashboard = readFileSync(resolve('storage/framework/core/actions/src/dev/dashboard.ts'), 'utf8')
    const uiConfig = readFileSync(resolve('config/ui.ts'), 'utf8')

    expect(dashboard).toContain("root: projectPath('resources')")
    expect(uiConfig).toContain("root: 'resources'")
  })
})
