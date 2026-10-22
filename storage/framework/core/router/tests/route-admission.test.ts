import { describe, expect, it } from 'bun:test'
import { createStacksRouter, listRegisteredRoutes, withRouteAdmission } from '../src/stacks-router'

/**
 * `withRouteAdmission` withholds routes whose string handler it rejects
 * (stacksjs/stacks#2943): they are never registered, so they answer 404, and
 * the chain API on them is inert.
 */
describe('withRouteAdmission', () => {
  it('withholds a rejected route, registers the rest, and reports why', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    const admit = (handler: string) => handler === 'Actions/NeedsMissingTable' ? 'Subscriber (table "subscribers" does not exist)' : undefined

    const withheld = await withRouteAdmission(admit, async () => {
      // The chain on a withheld route must not throw or attach anywhere.
      router.post('/admission/withheld', 'Actions/NeedsMissingTable').name('admission.withheld').middleware('auth')
      router.get('/admission/kept', () => new Response('kept'))
      router.match(['GET', 'POST'], '/admission/matched', 'Actions/NeedsMissingTable')
    })

    expect(withheld).toEqual([
      { method: 'POST', path: '/admission/withheld', handler: 'Actions/NeedsMissingTable', reason: 'Subscriber (table "subscribers" does not exist)' },
      { method: 'GET', path: '/admission/matched', handler: 'Actions/NeedsMissingTable', reason: 'Subscriber (table "subscribers" does not exist)' },
      { method: 'POST', path: '/admission/matched', handler: 'Actions/NeedsMissingTable', reason: 'Subscriber (table "subscribers" does not exist)' },
    ])

    expect((await router.handleRequest(new Request('http://localhost/admission/withheld', { method: 'POST' }))).status).toBe(404)
    expect((await router.handleRequest(new Request('http://localhost/admission/matched'))).status).toBe(404)
    expect(await (await router.handleRequest(new Request('http://localhost/admission/kept'))).text()).toBe('kept')

    const listed = listRegisteredRoutes().map(r => r.path)
    expect(listed).not.toContain('/admission/withheld')
    expect(listed).not.toContain('/admission/matched')
  })

  it('applies only while its registration runs', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    await withRouteAdmission(() => 'never', async () => {})

    router.get('/admission/after', () => new Response('after'))
    expect(await (await router.handleRequest(new Request('http://localhost/admission/after'))).text()).toBe('after')
  })

  it('lifts the check even when registration throws', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false })
    await expect(withRouteAdmission(() => 'never', async () => {
      throw new Error('bundle failed')
    })).rejects.toThrow('bundle failed')

    router.get('/admission/recovered', () => new Response('ok'))
    expect((await router.handleRequest(new Request('http://localhost/admission/recovered'))).status).toBe(200)
  })
})
