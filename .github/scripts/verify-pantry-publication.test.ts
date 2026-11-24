import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { checkPantryPublication } from './verify-pantry-publication'

const pkg = { name: '@stacksjs/buddy', version: '0.75.700', dir: 'storage/framework/core/buddy' }
let server: ReturnType<typeof Bun.serve>
let base: string
let mode: 'pantry' | 'npm-fallback' | 'missing' | 'flaky' = 'pantry'
let calls = 0

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      calls++
      const url = new URL(req.url)
      expect(url.pathname).toBe('/packages/%40stacksjs%2Fbuddy/0.75.700')
      if (mode === 'missing') return Response.json({ error: 'Package version not found' }, { status: 404 })
      if (mode === 'flaky' && calls < 2) return new Response('busy', { status: 503 })
      const tarballUrl = mode === 'npm-fallback'
        ? 'https://registry.npmjs.org/@stacksjs/buddy/-/buddy-0.75.700.tgz'
        : `${base}/packages/%40stacksjs%2Fbuddy/0.75.700/tarball`
      return Response.json({ name: pkg.name, version: pkg.version, tarballUrl })
    },
  })
  base = `http://localhost:${server.port}`
})

afterAll(() => server.stop(true))

describe('Pantry publication check', () => {
  it('accepts a version Pantry itself serves', async () => {
    mode = 'pantry'
    expect(await checkPantryPublication(pkg, base, 1, 0)).toEqual({ pkg, ok: true })
  })

  it('refuses npm\'s copy served through the registry fallback', async () => {
    mode = 'npm-fallback'
    const result = await checkPantryPublication(pkg, base, 1, 0)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toContain('only npm\'s copy')
  })

  it('reports a missing version without retrying it', async () => {
    mode = 'missing'
    calls = 0
    const result = await checkPantryPublication(pkg, base, 3, 0)
    expect(result).toEqual({ pkg, ok: false, reason: 'not on the registry' })
    expect(calls).toBe(1)
  })

  it('retries a transient failure', async () => {
    mode = 'flaky'
    calls = 0
    expect((await checkPantryPublication(pkg, base, 3, 0)).ok).toBe(true)
  })
})
