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
    const problem = apiDeploymentProblem({ pages: { start: 'bun cli.js serve' }, other: { start: 'bun preserve/api.jsx' } }, true)

    expect(problem).toContain('no site serves them')
  })

  it('shows how every site was classified when it refuses', () => {
    const problem = apiDeploymentProblem({ main: { start: 'bun cli.js serve' }, worker: { start: 'bun queue.js' } }, true)

    expect(problem).toContain('Sites examined:')
    expect(problem).toContain('`main` (page, no API_URL or PORT_API)')
    expect(problem).toContain('`worker` (page, no API_URL or PORT_API)')
  })

  it('names the API site in the classification when one is found but unwired', () => {
    const problem = apiDeploymentProblem({ 'main': { start: 'bun cli.js serve' }, 'loghq-api': loghqApi }, true)

    expect(problem).toContain('`loghq-api` (api)')
    expect(problem).toContain('`main` (page, no API_URL or PORT_API)')
    expect(problem).toContain('PORT_API')
  })
})

