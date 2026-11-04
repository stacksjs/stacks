/**
 * The test runner boots the same globals as the server.
 *
 * App code uses auto-imported names bare: an action is `new Action({...})`
 * with no import, a route file calls `route.get` on the global. `bun test`
 * never runs the framework preloader (bunfig `[test].preload` is
 * `tests/setup.ts`), so until setup booted them every one of those names was
 * undefined in a test, and a feature test that loaded a bare-style action died
 * with "Action is not defined" before reaching the assertion.
 */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const g = globalThis as Record<string, any>

describe('test boot', () => {
  test('injects the server auto-imports', () => {
    for (const name of ['Action', 'response', 'route', 'schema', 'log', 'config', 'db', 'Auth', 'dispatch', 'mail'])
      expect(typeof g[name], name).not.toBe('undefined')
  })

  test('injects the models', () => {
    expect(typeof g.User?.find).toBe('function')
  })

  test('loads an action written without imports', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'stacks-bare-action-'))
    try {
      const file = join(dir, 'PingAction.ts')
      writeFileSync(file, `export default new Action({
  name: 'Ping',
  validations: { note: { rule: schema.string().max(10) } },
  handle() { return response.json({ pong: true }) },
})
`)

      const action = (await import(file)).default
      const res = await action.handle({} as any)
      expect(await res.json()).toEqual({ pong: true })
    }
    finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
