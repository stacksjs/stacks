import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import process from 'node:process'
import { createStacksRouter, url } from '../src/stacks-router'

/**
 * Route params, in both spellings and both arities, match and generate.
 *
 * - `url()` substituted only `{name}`, so an optional `{slug?}` stayed in the
 *   URL literally: `url('posts', { slug: 'hello' })` gave
 *   `/posts/{slug?}?slug=hello`, and without a slug `/posts/{slug?}`.
 * - bun-router matches only braced params, so a route written `/a/:id`
 *   answered 404 for `/a/5`, while `url()` generated links to it.
 */
const savedAppUrl = process.env.APP_URL

beforeEach(() => {
  process.env.APP_URL = 'https://app.test'
})

afterEach(() => {
  if (savedAppUrl === undefined)
    delete process.env.APP_URL
  else
    process.env.APP_URL = savedAppUrl
})

async function json(router: ReturnType<typeof createStacksRouter>, path: string): Promise<{ status: number, body: unknown }> {
  const response = await router.handleRequest(new Request(`http://localhost${path}`, { headers: { accept: 'application/json' } }))
  return { status: response.status, body: response.status === 200 ? await response.json() : null }
}

describe('optional params', () => {
  it('fill the placeholder when given and drop its segment when not', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.get('/blog/{slug?}', (req: any) => ({ slug: req.params?.slug ?? null })).name('blog.optional')

    expect(url('blog.optional' as never, { slug: 'hello world' } as never)).toBe('https://app.test/blog/hello%20world')
    expect(url('blog.optional' as never)).toBe('https://app.test/blog')
    expect(url('blog.optional' as never, { slug: 'x', page: 2 } as never)).toBe('https://app.test/blog/x?page=2')

    expect(await json(router, '/blog/hello')).toEqual({ status: 200, body: { slug: 'hello' } })
    expect(await json(router, '/blog')).toEqual({ status: 200, body: { slug: null } })
  })
})

describe(':param routes', () => {
  it('match the paths url() generates for them', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.get('/colon/:id', (req: any) => ({ id: req.params?.id })).name('colon.show')
    router.group({ prefix: '/teams/:team' }, () => {
      router.get('/members/:member', (req: any) => ({ team: req.params?.team, member: req.params?.member })).name('colon.member')
    })

    expect(url('colon.show' as never, { id: 5 } as never)).toBe('https://app.test/colon/5')
    expect(await json(router, '/colon/5')).toEqual({ status: 200, body: { id: '5' } })
    expect(await json(router, '/teams/red/members/7')).toEqual({ status: 200, body: { team: 'red', member: '7' } })
  })

  it('leave a colon inside a segment alone', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.get('/at/12:30', () => ({ ok: true }))
    expect((await json(router, '/at/12:30')).status).toBe(200)
  })

  it('make a resource\'s show route answer, which registered as /:id it never did', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    router.get('/widgets/:id', (req: any) => ({ id: req.params?.id }))
    expect(await json(router, '/widgets/42')).toEqual({ status: 200, body: { id: '42' } })
    expect(router.bunRouter.routes.map((r: any) => r.path)).toContain('/widgets/{id}')
  })
})
