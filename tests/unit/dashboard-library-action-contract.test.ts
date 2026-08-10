import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const actions = resolve('storage/framework/defaults/app/Actions/Dashboard/Library')

function action(name: string): string {
  return readFileSync(resolve(actions, name), 'utf8')
}

describe('dashboard library action contract', () => {
  test('keeps source, dependency, and release reads behind safe boundaries', () => {
    const names = [
      'DependencyIndexAction.ts',
      'GetAverageReleaseTime.ts',
      'GetComponents.ts',
      'GetDownloadCount.ts',
      'GetFunctions.ts',
      'GetReleaseCount.ts',
      'GetReleases.ts',
      'PackageIndexAction.ts',
    ]

    for (const name of names) {
      const source = action(name)
      expect(source).toContain('apiResponse: true')
      expect(source.match(/dashboardOperationalError\(/g)?.length).toBe(1)
      expect(source).not.toContain('error instanceof Error ? error.message')
    }
  })

  test('returns created scaffolds only after source discovery succeeds', () => {
    const component = action('CreateComponent.ts')
    const fn = action('CreateFunction.ts')

    for (const source of [component, fn]) {
      expect(source).toContain('apiResponse: true')
      expect(source.match(/dashboardOperationalError\(/g)?.length).toBe(1)
      expect(source).toContain('if (!created)')
    }
    expect(component).toContain('await scaffoldComponent({ name })')
    expect(fn).toContain('await scaffoldFunction({ name })')
  })

  test('bounds release history before serialization', () => {
    const releases = action('GetReleases.ts')

    expect(releases).toContain("Release.orderByDesc('id').limit(500).get()")
  })

  test('labels unavailable telemetry instead of inventing download counts', () => {
    for (const name of ['GetComponentsDownloadCount.ts', 'GetFunctionsDownloadCount.ts']) {
      const source = action(name)
      expect(source).toContain('available: false')
      expect(source).toContain('downloads: null')
    }
  })
})
