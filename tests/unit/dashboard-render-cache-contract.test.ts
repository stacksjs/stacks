import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dashboardDevSource = readFileSync(
  join(process.cwd(), 'storage/framework/core/actions/src/dev/dashboard.ts'),
  'utf8',
)

describe('dashboard rendered route cache', () => {
  test('prewarms source-derived dashboard shells through native STX serving', () => {
    expect(dashboardDevSource).toContain('renderCache: true')
    expect(dashboardDevSource).toContain("renderCacheVary: 'source'")
    expect(dashboardDevSource).toContain('prewarmRenderCache: 4')
  })

  test('invalidates client bundles when dashboard composables change', () => {
    expect(dashboardDevSource).toContain("projectPath('resources/functions')")
    expect(dashboardDevSource).toContain("storagePath('framework/defaults/resources/functions')")
  })
})
