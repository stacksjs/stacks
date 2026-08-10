import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const actions = resolve('storage/framework/defaults/app/Actions/Dashboard/Cloud')

function action(name: string): string {
  return readFileSync(resolve(actions, name), 'utf8')
}

describe('dashboard cloud error contract', () => {
  test('keeps cloud state failures behind API response boundaries', () => {
    const cloud = action('CloudIndexAction.ts')
    const serverless = action('ServerlessIndexAction.ts')

    for (const source of [cloud, serverless]) {
      expect(source).toContain('apiResponse: true')
      expect(source.match(/dashboardOperationalError\(/g)?.length).toBe(1)
      expect(source).not.toContain('error instanceof Error ? error.message')
    }
  })
})
