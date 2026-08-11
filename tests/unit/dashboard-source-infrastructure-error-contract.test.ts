import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve('storage/framework/defaults/app/Actions/Dashboard')
const protectedReads = [
  'Actions/GetActions.ts',
  'Infrastructure/CommandIndexAction.ts',
  'Infrastructure/EnvironmentIndexAction.ts',
  'Infrastructure/RequestIndexAction.ts',
  'Infrastructure/ServerIndexAction.ts',
  'Infrastructure/ServerShowAction.ts',
  'Models/GetModels.ts',
  'Models/GetSubscriberCount.ts',
  'Releases/ReleaseIndexAction.ts',
]

describe('dashboard source and infrastructure error contract', () => {
  test('protects source, environment, model, request, release, and server reads', () => {
    for (const action of protectedReads) {
      const source = readFileSync(resolve(root, action), 'utf8')
      expect(source).toContain('catch (error)')
      expect(source).toContain('return dashboardOperationalError(error,')
      expect(source).not.toContain('error instanceof Error ? error.message')
    }
  })

  test('keeps environment validation and conflicts separate from write failures', () => {
    const source = readFileSync(resolve(root, 'Infrastructure/EnvironmentUpdateAction.ts'), 'utf8')
    expect(source).toContain("Environment content must be a string.' }, 422")
    expect(source).toContain("environment revision is required.' }, 422")
    expect(source).toContain('}, 409)')
    expect(source).toContain("return dashboardOperationalError(error, 'Environment file could not be saved.'")
  })

  test('validates server identifiers before loading cloud state', () => {
    const source = readFileSync(resolve(root, 'Infrastructure/ServerShowAction.ts'), 'utf8')
    expect(source.indexOf('/^[A-Za-z0-9:_-]{1,160}$/')).toBeLessThan(source.indexOf('getDashboardCloudSnapshot(tsCloud)'))
  })
})
