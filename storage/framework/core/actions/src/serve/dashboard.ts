/**
 * Production Dashboard Server Entry Point
 *
 * The staff dashboard, served as its own process — the deployable counterpart
 * to `dev/dashboard.ts`.
 *
 * It needs to be a separate server rather than a route on the main site
 * because a dashboard page resolves against a different tree entirely: its own
 * `layoutsDir`, its own `componentsDir`, and a page set drawn from BOTH the
 * app's `resources/views/dashboard` and the framework's own dashboard views.
 * `layouts/default` means the dashboard chrome here and the site's marketing
 * layout there, so the two cannot share one server without one shadowing the
 * other.
 *
 * WHY THIS FILE EXISTS AT ALL: until it did, an app could run its dashboard in
 * dev and had no supported way to deploy it. Pointing the production web
 * server at those views renders a 200 with an EMPTY BODY — the layout does not
 * resolve, so the page's sections render into nothing — which is how a whole
 * staff dashboard shipped to production looking like a working deploy.
 *
 * SECURITY: `dev/dashboard.ts` runs `auth: false`, deliberately, because it
 * serves one developer on localhost. Deploying that unchanged would publish
 * every staff page. This server DENIES BY DEFAULT instead: every page render
 * requires a valid session unless its path is explicitly public. See
 * `./dashboard-gate.ts` — the decision is pure and tested on its own.
 *
 * Deploy with:
 *   bun node_modules/@stacksjs/actions/dist/serve/dashboard.js
 *
 * Environment variables:
 *   - PORT_DASHBOARD / PORT: port to bind (default: 3002)
 *   - APP_ENV: environment (production, staging, ...)
 *
 * NETWORK EXPOSURE: `serve()` binds every interface, so what keeps this port
 * off the internet is the host firewall, not the process. The box this was
 * built for runs ufw with `policy DROP` and only 22/25/80/443 open, which is
 * the same thing already protecting every other service on it (the API on
 * 3008, each tenant's site on 31xx). Deploying this somewhere without that
 * firewall would expose the dashboard directly on the host's public IP,
 * bypassing the gateway's TLS — check before you do.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { projectPath, publicPath } from '@stacksjs/path'
import { resolveDefaultsRoot } from '../dev/defaults-resources'
import { decideDashboardAccess } from './dashboard-gate'

process.env.APP_ENV ||= 'production'
process.env.NODE_ENV ||= 'production'

const port = Number(process.env.PORT_DASHBOARD || process.env.PORT) || 3002

const defaultsRoot = resolveDefaultsRoot()
const frameworkDashboard = join(defaultsRoot, 'views/dashboard')
const appDashboard = projectPath('resources/views/dashboard')

const { authCookieName } = await import('@stacksjs/auth')
const authCookie = authCookieName()

/**
 * Read one cookie without trusting the header's shape.
 *
 * A value containing `=` (a JWT does not, a signed session can) must survive,
 * so the split is on the FIRST separator only.
 */
function readCookie(header: string | null, name: string): string | undefined {
  if (!header)
    return undefined

  for (const part of header.split(';')) {
    const raw = part.trim()
    const eq = raw.indexOf('=')
    if (eq < 1)
      continue
    if (raw.slice(0, eq) === name)
      return decodeURIComponent(raw.slice(eq + 1))
  }

  return undefined
}

/**
 * Where `/api/**` and every sign-in POST go.
 *
 * Resolved explicitly and allowed to be null: on a shared box
 * `127.0.0.1:<default>` is not "my API", it is whichever tenant bound that
 * port first, and forwarding a session cookie or a login POST there would
 * hand a visitor's credentials to a stranger. A 502 with an actionable log is
 * the better failure. Same rule and same helper as the main production
 * server — this used to be a second copy of the reasoning, which is how the
 * two drift.
 */
const { isApiBoundRequest, proxyToBackend, resolveApiBase, resolveApiProxyRules } = await import('@stacksjs/server')
const apiBase = resolveApiBase(config.ports?.api)

// The app's own `proxy` config, so a plain `GET /health` on the API process
// stays reachable from here exactly as it is from the public site.
const apiProxyRules = resolveApiProxyRules(config.server?.proxy)
const { Auth } = await import('@stacksjs/auth')
const { serve } = await import('bun-plugin-stx/serve')

await serve({
  // Both trees, exactly as the dev server discovers them: an app's own page
  // wins, and everything it does not define still comes from the framework.
  patterns: [appDashboard, frameworkDashboard].filter(dir => existsSync(dir)),
  port,

  // The dashboard's own chrome and components, NOT the site's.
  layoutsDir: frameworkDashboard,
  partialsDir: frameworkDashboard,
  componentsDir: join(defaultsRoot, 'resources/components/Dashboard'),
  // Assets belong to the application even when the page came from framework
  // storage.
  publicDir: publicPath(),

  quiet: true,

  /**
   * The gate.
   *
   * Runs before page resolution, so a path that renders nothing and a path
   * that renders a staff record are refused identically — an attacker learns
   * nothing from the difference.
   */
  onRequest: async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url)

    const decision = await decideDashboardAccess(
      {
        method: req.method,
        pathname: url.pathname,
        token: readCookie(req.headers.get('cookie'), authCookie),
      },
      token => Auth.getUserFromToken(token),
    )

    if (decision.allow) {
      // A dashboard page renders its shell server-side and then loads its data
      // over `/api/**`. Returning null for those hands them to the PAGE layer,
      // which answers a 404 HTML document — so every screen renders and then
      // reports that it could not load anything. They have to be forwarded to
      // the API process.
      if (isApiBoundRequest(req, url.pathname, apiProxyRules)) {
        if (!apiBase) {
          log.error(
            `No API target configured for ${url.pathname}. This dashboard shares its host with other `
            + `deployments, so there is no safe default port to guess - refusing to proxy. Set PORT_API `
            + `(or API_URL) for this site.`,
          )
          return new Response('Bad Gateway', { status: 502 })
        }

        try {
          return await proxyToBackend(req, apiBase)
        }
        catch (error) {
          log.error(`API proxy to ${apiBase} failed: ${(error as Error).message}`)
          return new Response('Bad Gateway', { status: 502 })
        }
      }

      return null
    }

    // `next` so signing in returns to the page that was asked for. The value
    // is the path only — never the full URL — so this cannot be turned into
    // an open redirect to another host.
    const next = encodeURIComponent(url.pathname + url.search)

    return new Response(null, {
      status: 302,
      headers: {
        'location': `/login?next=${next}`,
        // A refused page must never be cached, by the browser or by anything
        // between: a cached redirect for one visitor is a cached redirect for
        // the next, and a cached PAGE would outlive the session that earned it.
        'cache-control': 'no-store, private',
      },
    })
  },
})

// eslint-disable-next-line no-console
console.log(`Dashboard server listening on port ${port}`)
