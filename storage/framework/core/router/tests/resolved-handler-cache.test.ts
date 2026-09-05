import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { projectPath } from '@stacksjs/path'
import { createStacksRouter } from '../src/stacks-router'

const actions = projectPath('app/Actions')
mkdirSync(actions, { recursive: true })
const dir = mkdtempSync(join(actions, 'ResolvedHandlerFixture-'))
const prefix = `Actions/${basename(dir)}`
const token = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

afterAll(() => rmSync(dir, { recursive: true, force: true }))

function request(path: string, method = 'GET', headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { accept: 'application/json', cookie: `X-CSRF-Token=${token}`, ...headers },
  })
}

describe('resolved string handlers', () => {
  test('shares cold resolution and reuses the action across warm and newly registered routes', async () => {
    writeFileSync(join(dir, 'Shared.ts'), `
      await Bun.sleep(20)
      let resolutions = 0
      export default {
        get skipCsrf() { resolutions++; return true },
        handle(req) { return { resolutions, value: req.params.value } },
      }
    `)
    const router = createStacksRouter()
    router.get('/resolved-handler/first/{value}', `${prefix}/Shared`)
    router.get('/resolved-handler/second/{value}', `${prefix}/Shared`)
    const responses = await Promise.all([
      router.handleRequest(request('/resolved-handler/first/one')),
      router.handleRequest(request('/resolved-handler/second/two')),
    ])
    for (const [index, response] of responses.entries()) {
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ resolutions: 1, value: index === 0 ? 'one' : 'two' })
    }

    router.post('/resolved-handler/later/{value}', `${prefix}/Shared`)
    for (let i = 0; i < 3; i++) {
      const response = await router.handleRequest(request(`/resolved-handler/later/${i}`, 'POST'))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ resolutions: 1, value: String(i) })
    }
  })

  test('honors action CSRF flags before and after POST prefetch settles', async () => {
    const router = createStacksRouter()
    for (const skip of [true, false]) {
      const name = skip ? 'Exempt' : 'Protected'
      writeFileSync(join(dir, `${name}.ts`), `
        await Bun.sleep(20)
        export default { skipCsrf: ${skip}, handle() { return { ok: true } } }
      `)
      const path = `/resolved-handler/${name}`
      router.post(path, `${prefix}/${name}`)
      for (let i = 0; i < 2; i++) {
        const response = await router.handleRequest(request(path, 'POST'))
        expect(response.status).toBe(skip ? 200 : 403)
        const accepted = await router.handleRequest(request(path, 'POST', { 'x-csrf-token': token }))
        expect(accepted.status).toBe(200)
        expect(await accepted.json()).toEqual({ ok: true })
      }
    }
  })

  test('retries failed resolution and still reports errors from a warm handler', async () => {
    // A constructor failure retries resolution without relying on module reload.
    const name = 'RetryController'
    writeFileSync(join(dir, `${name}.ts`), `
      import { HttpError } from '@stacksjs/error-handling'
      let attempts = 0
      export default class {
        constructor() { if (++attempts === 1) throw new HttpError(503, 'Not ready') }
        index(req) {
          if (req.headers.get('x-test-fail')) throw new HttpError(409, 'Requested failure')
          return { attempts }
        }
      }
    `)
    const router = createStacksRouter()
    const path = '/resolved-handler/retry'
    router.get(path, `${prefix}/${name}`)
    expect((await router.handleRequest(request(path))).status).toBe(503)
    for (let i = 0; i < 2; i++) {
      const response = await router.handleRequest(request(path))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ attempts: 2 })
      const rejected = await router.handleRequest(request(path, 'GET', { 'x-test-fail': '1' }))
      expect(rejected.status).toBe(409)
    }
  })
})
