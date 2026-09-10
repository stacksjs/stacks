// The remote-command routes must not inherit the dashboard's local-env bypass
// (stacksjs/stacks#960).
//
// `guard()` in `routes/dashboard-api.ts` reads:
//
//   if (!IS_LOCAL_ENV)
//     r.middleware('auth').middleware('role:admin')
//
// and `IS_LOCAL_ENV` covers local, development, dev, test, testing and empty.
// That is a reasonable trade for operational telemetry on a developer machine.
// For an endpoint that runs commands on a server it is an unauthenticated
// command runner on every developer machine reachable on the network.
//
// Asserted against the route file as text, because that is where the mistake
// would be made - somebody adding a route next to the others and reaching for
// the helper they see used around it.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routes = readFileSync(join(import.meta.dir, '../../../../routes/dashboard-api.ts'), 'utf8')

/** The route lines for this feature, whatever helper they are wrapped in. */
const remoteRoutes = routes
  .split('\n')
  .filter(line => line.includes('Actions/Dashboard/Remote/'))

describe('remote-command routes', () => {
  it('registers both endpoints', () => {
    expect(remoteRoutes).toHaveLength(2)
    expect(remoteRoutes.join('\n')).toContain('RemoteCommandIndexAction')
    expect(remoteRoutes.join('\n')).toContain('RemoteCommandRunAction')
  })

  it('never uses the guard that drops auth in local environments', () => {
    // The whole point. `guard(` would mean no authentication at all under
    // APP_ENV=local, on a route that runs commands over SSH.
    for (const line of remoteRoutes)
      expect(line).not.toContain('guard(route')
  })

  it('uses the guard that keeps auth in every environment', () => {
    for (const line of remoteRoutes)
      expect(line).toContain('authenticatedGuard(route')
  })

  it('the two guards really do differ, so this is not vacuous', () => {
    // If `guard` and `authenticatedGuard` were the same, everything above would
    // pass for a route with no protection at all. They differ in exactly one
    // way: whether `auth` survives a local environment.
    const guardBody = routes.slice(routes.indexOf('function guard('), routes.indexOf('function authenticatedGuard('))
    const authenticatedBody = routes.slice(routes.indexOf('function authenticatedGuard('))

    expect(guardBody).toContain('if (!IS_LOCAL_ENV)\n    r.middleware(\'auth\')')
    expect(authenticatedBody.slice(0, 400)).toContain('r.middleware(\'auth\')\n  if (!IS_LOCAL_ENV)')
  })
})
