import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('AI action contract', () => {
  test('guards provider-backed routes with authentication', () => {
    const routes = source('storage/framework/defaults/routes/dashboard.ts')
    const aiRoutes = routes.slice(routes.indexOf('// AI'), routes.indexOf('// Voide'))

    expect(aiRoutes).toContain("route.group({ middleware: 'auth' }")
    expect(aiRoutes).toContain("route.post('/ai/ask', 'Actions/AI/AskAction')")
    expect(aiRoutes).toContain("route.post('/ai/summary', 'Actions/AI/SummaryAction')")
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
