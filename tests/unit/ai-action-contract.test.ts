import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('AI action contract', () => {
  /**
   * `/ai/*` hits the user's configured LLM provider server-side, so unguarded
   * it is a token bill and an exfiltration path. What is asserted here is that
   * the group goes through the shared guard helper and points at the AI
   * actions; that the helper's floor really is `auth` is asserted
   * behaviourally, against the registered routes, in
   * `core/router/tests/dashboard-access.test.ts`.
   *
   * Not asserted here as `route.group({ middleware: 'auth' }`, which is what
   * this pinned until stacksjs/stacks#2883 gave the group a prefix so
   * `config/dashboard.ts` could name it. The URLs and the gate were both
   * unchanged and the test failed anyway: a source-text contract test pins the
   * spelling along with the contract. Nor by importing the routes file, which
   * registers 319 routes into the shared router singleton at import time and
   * once hung 77 tests in the router suite (see
   * `fixtures/print-dashboard-routes.ts`).
   */
  test('routes the AI endpoints through the guarded group', () => {
    const routes = source('storage/framework/defaults/routes/dashboard.ts')
    const aiRoutes = routes.slice(routes.indexOf('// AI'), routes.indexOf('// Voide'))

    expect(aiRoutes).toContain(`prefix: '/ai'`)
    expect(aiRoutes).toContain(`guarded('/ai')`)
    expect(aiRoutes).toContain(`'Actions/AI/AskAction'`)
    expect(aiRoutes).toContain(`'Actions/AI/SummaryAction'`)
  })

  test('validates command requests without logging prompt contents', () => {
    for (const action of ['AskAction', 'SummaryAction']) {
      const contents = source(`storage/framework/defaults/app/Actions/AI/${action}.ts`)

      expect(contents).toContain("import type { RequestInstance } from '@stacksjs/types'")
      expect(contents).toContain('apiResponse: true')
      expect(contents).toContain('async handle(request: RequestInstance)')
      expect(contents).toContain('await request.validate()')
      expect(contents).toContain('return response.json({')
      expect(contents).toContain('}, 502)')
      expect(contents).toContain('log.error(')
      expect(contents).not.toContain('console.log(')
      expect(contents).not.toContain('console.error(')
      expect(contents).not.toContain('// TODO:')
    }
  })
})
