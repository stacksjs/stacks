/**
 * The promoted set must be exactly the published set.
 *
 * A package pantry publishes but this does not promote is stranded on the
 * holding tag; one promoted but not published names a version that is not
 * there. Both are the torn release the staged publish exists to prevent, so
 * the enumeration is pinned to the same globs the workflow passes.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { confirmPublications, inParallel, meaningfulNpmError, promotionFailureSummary, promoteTags, publishables } from './promote-latest'

const root = new URL('../../', import.meta.url).pathname

describe('registry publication confirmation', () => {
  it('waits for the exact accepted package to become visible', async () => {
    const requested: string[] = []
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
      requested.push(new URL(request.url).pathname)
      if (requested.length === 1) return new Response('pending', { status: 404 })
      return Response.json({ name: '@stacksjs/buddy', version: '0.75.115', dist: { tarball: 'https://registry.npmjs.org/buddy.tgz' } })
    } })
    try {
      await confirmPublications([{ name: '@stacksjs/buddy', version: '0.75.115', dir: 'buddy' }], server.url.href, 2, 0)
      expect(requested).toEqual(['/%40stacksjs%2Fbuddy/0.75.115', '/%40stacksjs%2Fbuddy/0.75.115'])
    }
    finally { server.stop(true) }
  })

  it('refuses a missing or mismatched artifact before promotion', async () => {
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
      if (request.url.includes('missing')) return new Response('missing', { status: 404 })
      return Response.json({ name: '@stacksjs/buddy', version: '0.75.114', dist: { tarball: 'https://registry.npmjs.org/buddy.tgz' } })
    } })
    try {
      await expect(confirmPublications([{ name: 'missing', version: '1.0.0', dir: '' }, { name: '@stacksjs/buddy', version: '0.75.115', dir: '' }], server.url.href, 1, 0)).rejects.toThrow('missing@1.0.0, @stacksjs/buddy@0.75.115; no latest tags were changed')
    }
    finally { server.stop(true) }
  })
})

describe('publishables', () => {
  it('keeps an installed framework release from selecting newer held versions', async () => {
    const meta = JSON.parse(readFileSync(`${root}storage/framework/core/package.json`, 'utf-8'))
    const parts = meta.version.split('.').map(Number)
    const newer = `${parts[0]}.${parts[1]}.${parts[2] + 1}`
    for (const pkg of await publishables(root)) {
      const range = meta.dependencies[pkg.name]
      if (!range || pkg.version !== meta.version) continue
      expect(Bun.semver.satisfies(meta.version, range), pkg.name).toBe(true)
      expect(Bun.semver.satisfies(newer, range), pkg.name).toBe(false)
    }
  })

  it('finds the scoped framework packages but not the separately published meta-package', async () => {
    const found = await publishables(root)
    const names = found.map(pkg => pkg.name)

    expect(names).not.toContain('stacks')
    expect(names).toContain('@stacksjs/actions')
    expect(names.length).toBeGreaterThan(50)
  })

  it('gives every package a concrete version to point latest at', async () => {
    const found = await publishables(root)

    // `workspace:*` or a missing version cannot address a registry entry.
    for (const pkg of found)
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('skips private packages, which never reach the registry', async () => {
    const found = await publishables(root)

    for (const pkg of found) {
      const manifest = JSON.parse(readFileSync(`${root}${pkg.dir}/package.json`, 'utf-8'))
      expect(manifest.private).toBeFalsy()
    }
  })

  it('covers the same globs the release workflow publishes', async () => {
    const workflow = readFileSync(`${root}.github/workflows/release.yml`, 'utf-8')

    // The scoped packages are published by publish-layers.ts, which enumerates
    // them with this same `publishables()`, so the two sets cannot drift. If the
    // publish step goes back to a glob, this enumeration has to follow it.
    expect(workflow).toContain('bun .github/scripts/publish-layers.ts --npm --access public --ignore-scripts --tag staging')
    expect(readFileSync(`${root}.github/scripts/publish-layers.ts`, 'utf-8')).toContain("import { publishables } from './promote-latest'")
    expect(workflow).toContain("--ignore-scripts 'storage/framework/core'")
  })
})

describe('meaningfulNpmError', () => {
  it('skips the log-path footer that used to be reported as the error', () => {
    // The shape npm actually produced when promoting `stacks` failed on
    // v0.74.14. That package is published through OIDC now rather than
    // promoted (6241eb6c52), but the stderr shape is npm's, not that
    // package's, and every promotion can still hit it.
    const stderr = [
      'npm error code E404',
      'npm error 404 Not Found - PUT https://registry.npmjs.org/-/package/stacks/dist-tags/latest',
      'npm error',
      'npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-09-03T22_28_52_123Z-debug-0.log',
    ].join('\n')

    expect(meaningfulNpmError(stderr)).toBe('404 Not Found - PUT https://registry.npmjs.org/-/package/stacks/dist-tags/latest')
  })

  it('handles the older npm ERR! prefix', () => {
    expect(meaningfulNpmError('npm ERR! E403 Forbidden\nnpm ERR! A complete log of this run can be found in: /tmp/x.log'))
      .toBe('E403 Forbidden')
  })

  it('says so plainly when npm wrote nothing useful', () => {
    expect(meaningfulNpmError('npm error\nnpm error A complete log of this run can be found in: /tmp/x.log')).toBe('no error output')
    expect(meaningfulNpmError('')).toBe('no error output')
  })
})

describe('inParallel', () => {
  it('moves several tags at once, never more than the limit, and keeps the order', async () => {
    let running = 0
    let most = 0
    const results = await inParallel([30, 5, 20, 10, 15], 3, async (ms) => {
      running++
      most = Math.max(most, running)
      await Bun.sleep(ms)
      running--
      return ms === 10 ? `failed ${ms}` : null
    })
    expect(most).toBe(3)
    expect(results).toEqual([null, null, null, 'failed 10', null])
  })
})

describe('registry tag promotion', () => {
  it('shares a registry cooldown with queued packages and sends only exact tag writes', async () => {
    const requests: { at: number, path: string, method: string, body: string, auth: string | null }[] = []
    let rateLimited = false
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
      requests.push({ at: performance.now(), path: new URL(request.url).pathname, method: request.method, body: await request.text(), auth: request.headers.get('authorization') })
      if (request.url.includes('buddy') && !rateLimited) {
        rateLimited = true
        return new Response('rate limited', { status: 429, headers: { 'Retry-After': '1' } })
      }
      if (request.url.includes('mobile')) await Bun.sleep(30)
      return new Response(null, { status: 204 })
    } })
    try {
      const failures = await promoteTags([{ name: '@stacksjs/buddy', version: '0.75.242', dir: '' }, { name: '@stacksjs/mobile', version: '0.75.242', dir: '' }, { name: '@stacksjs/features', version: '0.75.242', dir: '' }], { registry: server.url.href, token: 'fixture-token', concurrency: 2 })
      expect(failures).toEqual([])
      expect(requests).toHaveLength(4)
      expect(requests.find(r => r.path.includes('features'))!.at - requests[0]!.at).toBeGreaterThanOrEqual(950)
      expect(requests.map(r => [r.path, r.method, r.body, r.auth]).sort()).toEqual([
        ['/-/package/%40stacksjs%2Fbuddy/dist-tags/latest', 'PUT', '"0.75.242"', 'Bearer fixture-token'],
        ['/-/package/%40stacksjs%2Fbuddy/dist-tags/latest', 'PUT', '"0.75.242"', 'Bearer fixture-token'],
        ['/-/package/%40stacksjs%2Fmobile/dist-tags/latest', 'PUT', '"0.75.242"', 'Bearer fixture-token'],
        ['/-/package/%40stacksjs%2Ffeatures/dist-tags/latest', 'PUT', '"0.75.242"', 'Bearer fixture-token'],
      ].sort())
    }
    finally { server.stop(true) }
  })

  it('fails authentication once without exposing registry bodies or credentials', async () => {
    let calls = 0
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch() { calls++; return new Response('private-token-and-response', { status: 403 }) } })
    try {
      expect(await promoteTags([{ name: '@stacksjs/buddy', version: '0.75.242', dir: '' }], { registry: server.url.href, token: 'private-token' })).toEqual(['@stacksjs/buddy@0.75.242: registry HTTP 403'])
      expect(calls).toBe(1)
      // A prior attempt may already have promoted other packages. Zero new
      // acknowledgements cannot establish a complete previous cohort.
      expect(promotionFailureSummary(0, 85)).toContain('Remaining tag states are unconfirmed; the registry may contain a partial release.')
    }
    finally { server.stop(true) }
  })

  it('bounds a registry cooldown by the complete operation deadline', async () => {
    let calls = 0
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch() { calls++; return new Response(null, { status: 429, headers: { 'Retry-After': '3600' } }) } })
    try {
      expect(await promoteTags([{ name: '@stacksjs/buddy', version: '0.75.242', dir: '' }], { registry: server.url.href, token: 'fixture-token', budgetMs: 100 })).toEqual(['@stacksjs/buddy@0.75.242: registry cooldown exceeds promotion deadline'])
      expect(calls).toBe(1)
    }
    finally { server.stop(true) }
  })

  it('never forwards the token through a registry redirect', async () => {
    let forwarded = 0
    const destination = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch() { forwarded++; return new Response(null, { status: 204 }) } })
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch() { return new Response(null, { status: 307, headers: { Location: destination.url.href } }) } })
    try {
      const failures = await promoteTags([{ name: '@stacksjs/buddy', version: '0.75.242', dir: '' }], { registry: server.url.href, token: 'fixture-token', attempts: 1 })
      expect(failures).toHaveLength(1)
      expect(forwarded).toBe(0)
      expect(failures[0]).not.toContain('fixture-token')
    }
    finally { server.stop(true); destination.stop(true) }
  })
})
