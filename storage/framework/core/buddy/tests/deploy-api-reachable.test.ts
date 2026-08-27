/**
 * Whether anything will answer `/api/**` once the deploy lands.
 *
 * Stacks serves the API as its own process and the page server proxies to it,
 * which means a working deploy needs two declarations that nothing checked were
 * both made: an `api` site, and `PORT_API` (or `API_URL`) in the page server's
 * environment. `resolveApiBase` refuses to guess on a deployed box - the port
 * it would guess belongs to whichever tenant of a shared box got there first -
 * so a missing declaration is a 502, not a fallback.
 *
 * The failure is silent in the way that matters: the site serves, the front
 * page is 200, the deploy's own verification passes, and every `/api` request
 * fails. reviewos.org ran that way until somebody asked why a link preview was
 * blank.
 */

import { describe, expect, it } from 'bun:test'
import { apiDeploymentProblem } from '../src/commands/deploy'

const pageSite = { start: 'bun cli.js serve', port: 3072 }
const apiSite = { start: 'bun cli.js serve:api', port: 3008 }

describe('apiDeploymentProblem', () => {
  it('says nothing about a project with no API routes', () => {
    expect(apiDeploymentProblem({ main: pageSite }, false)).toBeUndefined()
  })

  it('catches an API surface that no site serves', () => {
    const problem = apiDeploymentProblem({ main: pageSite }, true)

    expect(problem).toContain('no site serves them')
    // The remedy, in the message: both halves have to be named or fixing one
    // leaves the deploy in the same place.
    expect(problem).toContain('buddy serve:api')
    expect(problem).toContain('PORT_API')
  })

  it('catches an api site the page server cannot find', () => {
    // The half that is easiest to miss: the service is there and running, and
    // the proxy still has nowhere to send anything.
    const problem = apiDeploymentProblem({ main: pageSite, api: apiSite }, true)

    expect(problem).toContain('`main`')
    expect(problem).toContain('PORT_API')
    // Naming the port it should be set to, since the answer is right there in
    // the other site.
    expect(problem).toContain('3008')
  })

  it('passes when both halves are declared', () => {
    expect(apiDeploymentProblem({
      main: { ...pageSite, env: { PORT_API: '3008' } },
      api: apiSite,
    }, true)).toBeUndefined()
  })

  it('accepts an API on another host, with no api site at all', () => {
    expect(apiDeploymentProblem({
      main: { ...pageSite, env: { API_URL: 'https://api.example.com' } },
    }, true)).toBeUndefined()
  })

  it('recognises the API by what it runs, not only by its name', () => {
    expect(apiDeploymentProblem({
      main: { ...pageSite, env: { PORT_API: '3008' } },
      backend: { start: 'bun cli.js serve:api', port: 3008 },
    }, true)).toBeUndefined()
  })

  it('leaves a project with no server app alone', () => {
    // A static or bucket site has no process to proxy from and nothing to fix.
    expect(apiDeploymentProblem({ marketing: { root: './dist' } }, true)).toBeUndefined()
  })
})

describe('apiDeploymentProblem: classifying the API site (#2349)', () => {
  // The reporter's config, verbatim in shape: the key is not `api` and the
  // start command invokes the entrypoint file rather than the `serve:api`
  // alias, so the old matcher counted the API site as a page server, then
  // refused the deploy because that "page" had no API_URL.
  const loghqApi = {
    root: '.',
    start: 'bun node_modules/@stacksjs/actions/dist/serve/api.js',
    port: 3043,
    env: { HOST: '127.0.0.1' },
  }
  const loghqPages = { root: '.', start: 'bun cli.js serve', port: 3042, env: { API_URL: 'http://127.0.0.1:3043' } }

  it('accepts a site that runs the API entrypoint under any key', () => {
    expect(apiDeploymentProblem({ 'main': loghqPages, 'loghq-api': loghqApi }, true)).toBeUndefined()
  })

  it('recognises the entrypoint however the path is spelled', () => {
    for (const start of [
      'bun node_modules/@stacksjs/actions/dist/serve/api.js',
      'bun serve/api.ts',
      'bun /srv/app/dist/serve/api.mjs',
      'buddy serve:api',
    ]) {
      // The page site is wired, so the only thing under test is whether `svc`
      // is recognised as the API rather than counted as a second page server.
      const sites = { pages: { start: 'bun cli.js serve', env: { PORT_API: '3043' } }, svc: { start } }
      expect(apiDeploymentProblem(sites, true)).toBeUndefined()
    }
  })

  it('does not mistake a neighbouring path for the API entrypoint', () => {
    // `preserve/api.js` ends in the same characters; the boundary has to hold
    // or an unrelated site silently becomes the API and the real one is missed.
    const problem = apiDeploymentProblem({ pages: { start: 'bun cli.js serve', port: 3000 }, other: { start: 'bun preserve/api.jsx', port: 3050 } }, true)

    expect(problem).toContain('no site serves them')
  })

  it('shows how every site was classified when it refuses', () => {
    const problem = apiDeploymentProblem({ main: { start: 'bun cli.js serve', port: 3000 }, worker: { start: 'bun queue.js', port: 3099 } }, true)

    expect(problem).toContain('Sites examined:')
    expect(problem).toContain('`main` (page, no API_URL or PORT_API)')
    expect(problem).toContain('`worker` (page, no API_URL or PORT_API)')
  })

  it('names the API site in the classification when one is found but unwired', () => {
    const problem = apiDeploymentProblem({ 'main': { start: 'bun cli.js serve', port: 3000 }, 'loghq-api': loghqApi }, true)

    expect(problem).toContain('`loghq-api` (api)')
    expect(problem).toContain('`main` (page, no API_URL or PORT_API)')
    expect(problem).toContain('PORT_API')
  })
})


/**
 * ts-cloud's dashboard is on the box but is not this project's site: it is
 * adopted from whatever is already running there - which is why the deploy path
 * reconciles its port from the live box rather than reading one from
 * config/cloud.ts - and it serves ts-cloud's admin UI, not `routes/api.ts`.
 *
 * Holding it to "must proxy to the project's API" asked it to wire up routes it
 * does not serve, and refused every deploy of a box that has a dashboard on it.
 * That is what blocked stacksjs.com: `main` was genuinely missing `PORT_API`,
 * and `dashboard-stacksjs-com` was never going to have it.
 */
describe('apiDeploymentProblem and the ts-cloud dashboard', () => {
  const api = { start: 'bun cli.js serve:api', port: 3008 }

  it('does not ask the dashboard to proxy to the API', () => {
    expect(apiDeploymentProblem({
      main: { ...pageSite, env: { PORT_API: '3008' } },
      api,
      'dashboard-stacksjs-com': { start: 'bun dashboard.js', port: 3009 },
    }, true)).toBeUndefined()
  })

  it('covers the bare `dashboard` name too', () => {
    expect(apiDeploymentProblem({
      main: { ...pageSite, env: { PORT_API: '3008' } },
      api,
      dashboard: { start: 'bun dashboard.js', port: 3009 },
    }, true)).toBeUndefined()
  })

  it('still catches a real page server that cannot reach the API', () => {
    // The exemption is by name and must not become a way to miss the actual bug.
    const problem = apiDeploymentProblem({
      main: pageSite,
      api,
      'dashboard-stacksjs-com': { start: 'bun dashboard.js', port: 3009 },
    }, true)

    expect(problem).toContain('`main`')
    expect(problem).not.toContain('dashboard-stacksjs-com` will not proxy')
  })
})

describe('apiDeploymentProblem: headless sites (#2367)', () => {
  // `bun buddy queue:work` and `bun buddy schedule:run`, verbatim in shape:
  // a `start` command, an environment, and no listener of any kind.
  const worker = { root: '.', start: 'bun buddy queue:work', preStart: ['bun install'], env: { APP_ENV: 'production' } }
  const scheduler = { root: '.', start: 'bun buddy schedule:run', preStart: ['bun install'], env: { APP_ENV: 'production' } }

  it('does not require a headless worker to proxy to the API', () => {
    // The reported failure: a valid config refused before anything uploaded,
    // over an `/api/**` surface these processes never expose.
    expect(apiDeploymentProblem({
      main: { ...pageSite, env: { PORT_API: '3008' } },
      api: apiSite,
      worker,
      scheduler,
    }, true)).toBeUndefined()
  })

  it('does not claim the API is unserved when the site set is one headless worker', () => {
    // The second branch of the same misclassification, and the more dangerous
    // one: a role-specific deploy whose set has no API site because the
    // primary owns it. This workflow only runs when its own config changes, so
    // it stayed broken quietly.
    expect(apiDeploymentProblem({ checksWorker: worker }, true)).toBeUndefined()
  })

  it('reports a headless site as headless rather than as an unwired page', () => {
    const problem = apiDeploymentProblem({ main: pageSite, api: apiSite, worker }, true)

    expect(problem).toContain('`main` (page, no API_URL or PORT_API)')
    expect(problem).toContain('`worker` (headless, no HTTP surface)')
  })

  it('still holds a page server to the check when it declares only a domain', () => {
    // Reachable through the gateway without declaring a port, so it does proxy
    // `/api/**` and does need to say where.
    const problem = apiDeploymentProblem({
      main: { start: 'bun cli.js serve', domain: 'example.com' },
      api: apiSite,
    }, true)

    expect(problem).toContain('`main`')
    expect(problem).toContain('PORT_API')
  })
})
