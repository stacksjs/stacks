import { describe, expect, it } from 'bun:test'
import { createStacksRouter, listRedirectRoutes } from '../src'

describe('route.redirect() and route.permanentRedirect()', () => {
  it('answers like Laravel: 302 by default, 301 when permanent, the query carried along', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    router.redirect('/redirect-test/here', '/there')
    router.permanentRedirect('/redirect-test/moved', '/new-home')
    router.redirect('/redirect-test/see-other', 'https://example.com/elsewhere', 303)
    router.redirect('/redirect-test/fixed-query', '/target?ref=menu')

    const server = await router.serve({ port: 0, hostname: '127.0.0.1' })
    const at = (path: string) => fetch(`http://127.0.0.1:${server.port}${path}`, { redirect: 'manual' })

    try {
      const temporary = await at('/redirect-test/here')
      expect(temporary.status).toBe(302)
      expect(temporary.headers.get('location')).toBe('/there')

      const permanent = await at('/redirect-test/moved?utm_source=newsletter')
      expect(permanent.status).toBe(301)
      expect(permanent.headers.get('location')).toBe('/new-home?utm_source=newsletter')

      const offSite = await at('/redirect-test/see-other')
      expect(offSite.status).toBe(303)
      expect(offSite.headers.get('location')).toBe('https://example.com/elsewhere')

      // A target that names its own query keeps it rather than gaining a second one.
      const ownQuery = await at('/redirect-test/fixed-query?utm_source=x')
      expect(ownQuery.headers.get('location')).toBe('/target?ref=menu')
    }
    finally {
      server.stop()
    }
  })

  it('records each redirect by its full path, group prefix included', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    await router.group({ prefix: '/redirect-group' }, () => {
      router.permanentRedirect('/old', '/redirect-group/new')
    })

    expect(listRedirectRoutes()).toContainEqual({ path: '/redirect-group/old', to: '/redirect-group/new', status: 301 })
  })

  it('refuses a status that is not a redirect, and a missing target', () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })

    expect(() => router.redirect('/redirect-test/bad', '/x', 200 as any)).toThrow('is not a redirect status')
    expect(() => router.redirect('/redirect-test/nowhere', '')).toThrow('needs somewhere to go')
  })

  it('returns a chainable route, so a redirect can be named', () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    const chain = router.permanentRedirect('/redirect-test/named', '/')

    expect(typeof chain.name).toBe('function')
  })
})
