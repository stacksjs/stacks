import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * stacksjs/stacks#3198: the commerce browser composables (`useCustomers`,
 * `useOrders`, ...) wrote with a bare fetch and no CSRF token, so a create,
 * update or delete from a browser signed in with the session cookie answered
 * 403 before the action ran.
 *
 * Every write of every module runs here against a captured fetch with a CSRF
 * cookie present, and each must carry the token. The modules are discovered
 * rather than listed, so a new one is covered, and a read must not carry it,
 * which is the control: a client that attached it to everything would pass
 * the writes for the wrong reason.
 */

const ROOT = resolve('storage/framework/defaults/functions/commerce')

function modules(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory())
      return modules(path)
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : []
  })
}

interface Sent { method: string, token: string | null }
const sent: Sent[] = []
const scope = globalThis as Record<string, unknown>
const realFetch = globalThis.fetch
const hadDocument = 'document' in scope
const realDocument = scope.document

beforeAll(() => {
  scope.document = { cookie: 'X-CSRF-Token=token-from-the-cookie' }
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    sent.push({ method: (init?.method ?? 'GET').toUpperCase(), token: new Headers(init?.headers).get('X-CSRF-Token') })
    return new Response(JSON.stringify({ data: { id: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch
})

afterAll(() => {
  globalThis.fetch = realFetch
  if (hadDocument)
    scope.document = realDocument
  else
    delete scope.document
})

const files = modules(ROOT)

describe('commerce browser composables', () => {
  it('finds the modules', () => {
    expect(files.length).toBeGreaterThanOrEqual(14)
  })

  for (const file of files) {
    it(`${relative(ROOT, file)} sends the CSRF token on every write, and not on a read`, async () => {
      const module = await import(file) as Record<string, unknown>
      const composable = Object.entries(module).find(([name, value]) => name.startsWith('use') && typeof value === 'function')
      // A shared helper with no composable of its own is covered through the
      // modules that use it.
      if (!composable)
        return
      const api = (composable![1] as () => Record<string, unknown>)()

      sent.length = 0
      for (const [name, fn] of Object.entries(api)) {
        if (typeof fn !== 'function')
          continue
        if (/^(create|update|add|store)/.test(name))
          await (fn as (value: unknown) => Promise<unknown>)({ id: 1 })
        else if (/^(delete|remove|destroy)/.test(name))
          await (fn as (value: unknown) => Promise<unknown>)(1)
        else if (/^fetch/.test(name))
          await (fn as () => Promise<unknown>)()
      }

      const writes = sent.filter(request => request.method !== 'GET')
      const reads = sent.filter(request => request.method === 'GET')
      expect(writes.length, 'the module has writes').toBeGreaterThanOrEqual(3)
      expect(writes.filter(request => request.token !== 'token-from-the-cookie')).toEqual([])
      expect(reads.length, 'the module has a read').toBeGreaterThanOrEqual(1)
      expect(reads.filter(request => request.token !== null)).toEqual([])
    })
  }
})
