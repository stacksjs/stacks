// Route-model binding (stacksjs/stacks#2231).
//
// The framework ships a Policy system and a `can:` middleware that could not be
// connected. `Can` handed the RAW STRING from the route parameter to
// `authorize()`, while `resolveAbility()` only reaches for a policy when the
// first argument is an object whose `constructor.name` matches a registration.
// A string's is `String`, so `can:view,site` could never dispatch to
// `SitePolicy.view(user, site)` — every ownership check had to be written
// imperatively inside the handler, and an endpoint that forgot the prologue was
// readable by anyone.
//
// The property under test is not just "a model comes back". It is that an
// UNBOUND parameter still passes its raw string through, because otherwise
// every existing `can:ability,param` route changes meaning at once.

import { afterEach, describe, expect, it } from 'bun:test'
import {
  clearRouteModelBindings,
  defineRouteModelBinding,
  resolveRouteModel,
  routeModelBindings,
  setRouteModelFallback,
} from '../src/route-model-binding'

class Site {
  constructor(public id: number) {}
}

afterEach(() => {
  clearRouteModelBindings()
})

describe('an unbound parameter is untouched (#2231)', () => {
  it('reports not-bound when nothing claims it', () => {
    // The compatibility guarantee. `bound: false` is what tells Can to push the
    // raw string, exactly as it did before any of this existed.
    expect(resolveRouteModel('site', '7')).resolves.toEqual({ bound: false })
  })
})

describe('an explicit binding resolves a model (#2231)', () => {
  it('returns the instance, so a policy can match on its constructor', () => {
    defineRouteModelBinding('site', id => new Site(Number(id)))

    return resolveRouteModel('site', '7').then((result) => {
      expect(result.bound).toBeTrue()
      expect(result.model).toBeInstanceOf(Site)
      // The exact reason the raw string failed: this is what resolveAbility
      // looks up in the policy registry.
      expect((result.model as any).constructor.name).toBe('Site')
    })
  })

  it('awaits an async resolver', async () => {
    defineRouteModelBinding('site', async id => new Site(Number(id)))
    const result = await resolveRouteModel('site', '9')
    expect((result.model as Site).id).toBe(9)
  })

  it('passes the raw value through', async () => {
    // Slugs, uuids and scoped keys are all legitimate — the binding decides
    // what the value means, not the router.
    defineRouteModelBinding('site', value => ({ key: value }))
    const result = await resolveRouteModel('site', 'my-slug')
    expect(result.model).toEqual({ key: 'my-slug' })
  })

  it('receives the parameter name and the request', async () => {
    let seen: any
    defineRouteModelBinding('site', (value, context) => {
      seen = { value, ...context }
      return new Site(1)
    })

    await resolveRouteModel('site', '7', { marker: true })
    expect(seen.param).toBe('site')
    expect(seen.value).toBe('7')
    expect(seen.request).toEqual({ marker: true })
  })

  it('the last registration wins', () => {
    defineRouteModelBinding('site', () => 'first')
    defineRouteModelBinding('site', () => 'second')
    return resolveRouteModel('site', '1').then(r => expect(r.model).toBe('second'))
  })
})

describe('bound but missing is not the same as unbound (#2231)', () => {
  it('a null row stays bound with no model', async () => {
    // Collapsing these two would make a missing row indistinguishable from an
    // unclaimed parameter, and the raw id string would be handed to the policy
    // layer — silently reintroducing the bug.
    defineRouteModelBinding('site', () => null)
    expect(await resolveRouteModel('site', '404')).toEqual({ bound: true, model: undefined })
  })

  it('a resolver returning undefined declines instead', async () => {
    // How the convention fallback says "there is no model of this name".
    defineRouteModelBinding('site', () => undefined)
    expect(await resolveRouteModel('site', '7')).toEqual({ bound: false })
  })

  it('a throwing resolver denies rather than 500ing', async () => {
    // A lookup failure must not turn an authorization check into a server
    // error, and no model means deny, which is the safe direction.
    defineRouteModelBinding('site', () => { throw new Error('db down') })
    expect(await resolveRouteModel('site', '7')).toEqual({ bound: true, model: undefined })
  })
})

describe('the fallback (#2231)', () => {
  it('serves a parameter with no explicit binding', async () => {
    setRouteModelFallback((id, { param }) => ({ param, id }))
    expect(await resolveRouteModel('site', '7')).toEqual({ bound: true, model: { param: 'site', id: '7' } })
  })

  it('an explicit binding still wins over it', async () => {
    // Scoped lookups, soft deletes and slug-instead-of-id all need to be
    // expressible over the convention.
    setRouteModelFallback(() => 'from-fallback')
    defineRouteModelBinding('site', () => 'from-binding')
    expect((await resolveRouteModel('site', '7')).model).toBe('from-binding')
  })

  it('can be removed', async () => {
    setRouteModelFallback(() => 'x')
    setRouteModelFallback(null)
    expect(await resolveRouteModel('site', '7')).toEqual({ bound: false })
  })
})

describe('the registry is inspectable (#2231)', () => {
  it('lists what is bound', () => {
    defineRouteModelBinding('site', () => null)
    defineRouteModelBinding('post', () => null)
    expect(routeModelBindings()).toEqual(['post', 'site'])
  })
})

describe('Can goes through it (#2231)', () => {
  const source = require('node:fs').readFileSync(
    require('node:path').join(import.meta.dir, '../../../defaults/app/Middleware/Can.ts'),
    'utf8',
  ) as string

  it('resolves the parameter instead of pushing the raw string', () => {
    expect(source).toContain('resolveRouteModel(')
  })

  it('still pushes the raw value when nothing is bound', () => {
    // The regression this must not cause.
    expect(source).toContain('if (!resolution.bound)')
    expect(source).toContain('args.push(raw)')
  })

  it('registers the ORM convention as a fallback, not a per-name binding', () => {
    // A per-name registration could not be overridden by an app without an
    // unregister call.
    expect(source).toContain('setRouteModelFallback(')
  })
})
