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
    expect(dashboardDevSource).toContain('publicDir: publicPath()')
  })

  test('invalidates client bundles when dashboard composables change', () => {
    // Both halves of the override chain are watched: the project's own
    // functions and the framework's. The second reads through `defaultsPath`
    // rather than a hardcoded `storage/framework/defaults`, so that it still
    // points at the defaults when they are not vendored (stacksjs/stacks#2941).
    expect(dashboardDevSource).toContain("projectPath('resources/functions')")
    expect(dashboardDevSource).toContain("defaultsPath('resources/functions')")
  })
})
