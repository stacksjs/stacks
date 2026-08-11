import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readAction(name: string): string {
  return readFileSync(resolve('storage/framework/defaults/app/Actions/Dashboard', name), 'utf8')
}

describe('dashboard overview error contract', () => {
  test('keeps partial home and stats failures useful but private', () => {
    for (const action of ['DashboardHomeAction.ts', 'DashboardStatsAction.ts']) {
      const source = readAction(action)
      expect(source).toContain('dashboardOperationalIssue(')
      expect(source).not.toContain('result.reason instanceof Error ? result.reason.message')
      expect(source).not.toContain("message: check.message || ''")
    }
  })

  test('protects the complete health endpoint and sanitizes failed probes', () => {
    const source = readAction('DashboardHealthAction.ts')
    expect(source).toContain('try {')
    expect(source).toContain("message: check.ok ? undefined : 'Dependency probe failed.'")
    expect(source).toContain("return dashboardOperationalError(error, 'System health could not be loaded.'")
  })
})
