import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dashboardConfigRoutes, listConfigFiles, rewriteConfigFields } from '../src/dev/dashboard-config'

const source = `throw new Error('Configuration inspection must never evaluate this module')
const settings = {
  // Preserve this comment and the original environment binding.
  app: { name: 'Stacks', host: env.APP_HOST ?? 'localhost' },
  replicas: [{ port: 3000, enabled: true }],
  'display.name': 'Original',
  port: 1, 'port': 40, port: env.PORT,
} satisfies Config
export const tls = { enabled: true, offset: -14 }
export default settings
`

describe('dashboard project configuration', () => {
  let directory: string
  let file: string
  let routes: ReturnType<typeof dashboardConfigRoutes>
  let validate: ReturnType<typeof mock>

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'stacks-config-'))
    file = join(directory, 'app.ts')
    writeFileSync(file, source)
    validate = mock(async (request: Request) => {
      if (!request.headers.has('x-csrf-token'))
        throw Object.assign(new Error('Forbidden'), { status: 403 })
    })
    routes = dashboardConfigRoutes({ directory, hosts: () => ['localhost:3002'], validateWrite: validate })
  })

  afterEach(() => rmSync(directory, { force: true, recursive: true }))

  function request(path: string, body?: unknown, headers: HeadersInit = { 'x-stacks-config': '1', 'x-csrf-token': 'test' }, origin = 'http://localhost:3002'): Promise<Response> {
    const url = new URL(path, origin)
    return routes[url.pathname]!(new Request(url, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }))
  }

  it('lists custom and disabled-feature files without following links', () => {
    mkdirSync(join(directory, 'hosting'))
    writeFileSync(join(directory, 'commerce.ts'), 'export default { enabled: false }')
    writeFileSync(join(directory, 'hosting', 'My region.ts'), source)
    writeFileSync(join(directory, '.hidden.ts'), source)
    writeFileSync(join(directory, 'schema.d.ts'), '')
    symlinkSync(file, join(directory, 'linked.ts'))

    expect(listConfigFiles(directory).map(({ name }) => name)).toEqual(['app', 'commerce', 'hosting/My region'])
    expect(listConfigFiles(join(directory, 'missing'))).toEqual([])
  })

  it('loads nested literals and named exports without evaluating code or resolving credentials', async () => {
    const response = await request('/api/config/read?name=app')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    const document = await response.json()
    expect(document.source).toBe(source)
    expect(document.fields.map((field: { key: string }) => field.key)).toEqual([
      'app.name', 'replicas[0].port', 'replicas[0].enabled', '["display.name"]', 'tls.enabled', 'tls.offset',
    ])
  })

  it('changes literal ranges while preserving comments, escapes, expressions and other exports', () => {
    const name = 'new \\ path\nwith "quotes" and an apostrophe: \''
    const rewritten = rewriteConfigFields(source, [
      { key: 'app.name', value: name },
      { key: 'replicas[0].port', value: 3002 },
      { key: 'tls.enabled', value: false },
    ])
    expect(rewritten).toContain("host: env.APP_HOST ?? 'localhost'")
    expect(rewritten).toContain('Preserve this comment')
    expect(rewritten).toContain('replicas: [{ port: 3002, enabled: true }]')
    expect(rewritten).toContain('export const tls = { enabled: false, offset: -14 }')
    writeFileSync(file, rewritten)
    return request('/api/config/read?name=app').then(async (response) => {
      expect((await response.json()).fields[0].value).toBe(name)
    })
  })

  it('never treats an overwritten literal as a form field', () => {
    expect(() => rewriteConfigFields('export default { port: 80, ...values }', [{ key: 'port', value: 81 }])).toThrow('Cannot edit')
    expect(() => rewriteConfigFields('export default { port: 80, "port": call() }', [{ key: 'port', value: 81 }])).toThrow('Cannot edit')
    expect(rewriteConfigFields('export default { ...values, port: 80 }', [{ key: 'port', value: 81 }])).toBe('export default { ...values, port: 81 }')
  })

  it('rejects invalid batches, invalid syntax and stale revisions without modifying the file', async () => {
    const { revision } = await (await request('/api/config/read?name=app')).json()
    const payload = { file: 'app', revision }
    const invalid = await request('/api/config/update', { ...payload, updates: [
      { key: 'app.name', value: 'New name' }, { key: 'tls.enabled', value: 'wrong type' },
    ] })
    expect(invalid.status).toBe(422)
    expect((await request('/api/config/update', { ...payload, source: 'export default {' })).status).toBe(422)
    expect((await request('/api/config/update', { ...payload, source, updates: [] })).status).toBe(400)
    expect(readFileSync(file, 'utf8')).toBe(source)

    const next = source.replace("env.APP_HOST ?? 'localhost'", "process.env.APP_HOST ?? 'local.test'")
    const success = await request('/api/config/update', { ...payload, source: next })
    expect(success.status).toBe(200)
    expect((await success.json()).revision).not.toBe(revision)
    expect(readFileSync(file, 'utf8')).toBe(next)
    expect((await request('/api/config/update', { ...payload, source })).status).toBe(409)
    expect(readFileSync(file, 'utf8')).toBe(next)
  })

  it('keeps broken files available for source repair', async () => {
    writeFileSync(file, 'export default { port:')
    const result = await (await request('/api/config/read?name=app')).json()
    expect(result.diagnostic).toContain('Invalid TypeScript at line')
    expect(result.fields).toEqual([])
    expect((await request('/api/config/update', { file: 'app', revision: result.revision, source })).status).toBe(200)
  })

  it('guards both reads and writes and cannot address other files', async () => {
    symlinkSync(file, join(directory, 'linked.ts'))
    expect((await request('/api/config/read?name=app', undefined, {})).status).toBe(403)
    expect((await request('/api/config/read?name=app', undefined, { 'x-stacks-config': '1', 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    expect((await request('/api/config/read?name=app', undefined, { 'x-stacks-config': '1' }, 'http://outside.test')).status).toBe(403)
    expect((await request('/api/config/read?name=..%2Fapp')).status).toBe(400)
    expect((await request('/api/config/read?name=linked')).status).toBe(404)
    expect((await request('/api/config/update', {}, { 'x-stacks-config': '1' })).status).toBe(403)
    expect(validate).toHaveBeenCalledTimes(1)
  })
})
