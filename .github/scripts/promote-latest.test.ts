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
import { exchangePromotionToken, recordPromotionPermissions, validatePromotionPermissions } from './npm-oidc-promotion'
import { confirmPublications, inParallel, meaningfulNpmError, npmPublicationTag, promotionFailureSummary, promoteTags, publishables } from './promote-latest'

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
      await expect(confirmPublications([{ name: 'missing', version: '1.0.0', dir: '' }, { name: '@stacksjs/buddy', version: '0.75.115', dir: '' }], server.url.href, 1, 0)).rejects.toThrow('missing@1.0.0, @stacksjs/buddy@0.75.115. Accepted uploads may still be awaiting')
    }
    finally { server.stop(true) }
  })

  it('checks latest separately from archive availability', async () => {
    const pkg = { name: '@stacksjs/buddy', version: '0.75.242', dir: '' }
    const requested: string[] = []
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
      const path = new URL(request.url).pathname
      requested.push(path)
      const version = path.endsWith('/latest') ? '0.75.241' : pkg.version
      return Response.json({ name: pkg.name, version, dist: { tarball: 'https://registry.npmjs.org/buddy.tgz' } })
    } })
    try {
      await confirmPublications([pkg], server.url.href, 1, 0)
      await expect(confirmPublications([pkg], server.url.href, 1, 0, 'latest')).rejects.toThrow('latest for @stacksjs/buddy@0.75.242')
      expect(requested).toEqual(['/%40stacksjs%2Fbuddy/0.75.242', '/%40stacksjs%2Fbuddy/latest'])
    }
    finally { server.stop(true) }
  })
})

describe('trusted publishing promotion', () => {
  const packages = ['@stacksjs/buddy', '@stacksjs/support'].map(name => ({ name, version: '0.75.242', dir: '' }))
  const registration = {
    type: 'github',
    claims: { repository: 'stacksjs/stacks', workflow_ref: { file: 'release.yml' } },
    permissions: ['createPackage', 'manageDistTags'],
  }

  it('requires both permissions on the matching registration for every package', async () => {
    for (const wrong of [
      { ...registration, permissions: ['createPackage'] },
      { ...registration, permissions: ['createStagedPackage', 'manageDistTags'] },
      { ...registration, claims: { ...registration.claims, environment: 'production' } },
      { ...registration, claims: { ...registration.claims, repository: 'stacksjs/stx' } },
      { ...registration, claims: { ...registration.claims, workflow_ref: { file: 'ci.yml' } } },
    ]) {
      const read = async (name: string) => name === '@stacksjs/buddy' ? [registration] : [wrong]
      await expect(recordPromotionPermissions(packages, '0.75.242', read)).rejects.toThrow('@stacksjs/support')
    }
  })

  it('binds permission evidence to this release and the complete scoped cohort', async () => {
    const receipt = await recordPromotionPermissions(packages, '0.75.242', async () => [registration])
    validatePromotionPermissions(JSON.stringify(receipt), packages, '0.75.242')
    expect(() => validatePromotionPermissions(JSON.stringify(receipt), packages, '0.75.243')).toThrow('0.75.243')
    expect(() => validatePromotionPermissions(JSON.stringify(receipt), packages.slice(0, 1), '0.75.242')).toThrow('package set')
    expect(() => validatePromotionPermissions(JSON.stringify({ ...receipt, packages: [packages[0]!.name, packages[0]!.name] }), packages, '0.75.242')).toThrow('package set')
  })

  it('rejects expired and redirected exchanges without exposing either credential', async () => {
    let forwarded = 0
    let redirected = false
    const foreign = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch() { forwarded++; return new Response() } })
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
      if (request.method === 'GET') return Response.json({ value: 'github-identity' })
      if (redirected) return new Response(null, { status: 307, headers: { Location: foreign.url.href } })
      return Response.json({ token_type: 'oidc', token: 'expired-credential', expires: '2025-01-01T00:00:00.000Z' }, { status: 201 })
    } })
    const exchange = () => exchangePromotionToken('@stacksjs/support', server.url, 'runner-token', server.url)
    try {
      await expect(exchange()).rejects.toThrow('npm OIDC exchange for @stacksjs/support returned an invalid or expired token')
      redirected = true
      await expect(exchange()).rejects.toThrow('npm OIDC exchange for @stacksjs/support request failed')
      expect(forwarded).toBe(0)
    }
    finally { server.stop(true); foreign.stop(true) }
  })

  it('uses fresh package-scoped exchange tokens when retrying a partly promoted cohort', async () => {
    const tagWrites: [string, string | null][] = []
    const latest = new Map<string, string>()
    let identityRequests = 0
    let rejectSupport = true
    let forwarded = 0
    const foreign = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch() { forwarded++; return new Response() } })
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
      const url = new URL(request.url)
      const auth = request.headers.get('authorization')
      if (url.pathname === '/identity') {
        expect(auth).toBe('Bearer runner-token')
        expect(url.searchParams.get('audience')).toBe('npm:registry.npmjs.org')
        return Response.json({ value: `github-${++identityRequests}` })
      }
      if (url.pathname.startsWith('/-/npm/v1/oidc/token/exchange/package/')) {
        expect(request.method).toBe('POST')
        expect(auth).toMatch(/^Bearer github-\d+$/)
        const token = `${decodeURIComponent(url.pathname.split('/').at(-1)!)}:${auth!.slice(7)}`
        return Response.json({ token_type: 'oidc', token, expires: new Date(Date.now() + 60 * 60_000).toISOString() }, { status: 201 })
      }
      const name = decodeURIComponent(url.pathname.split('/')[request.method === 'PUT' ? 3 : 1]!)
      if (request.method === 'PUT') {
        tagWrites.push([name, auth])
        expect(auth).toStartWith(`Bearer ${name}:github-`)
        if (rejectSupport && name.endsWith('/support')) return new Response('private registry response', { status: 403 })
        latest.set(name, await request.json() as string)
        return new Response(null, { status: 204 })
      }
      return Response.json({ name, version: latest.get(name), dist: { tarball: `${url.origin}/original.tgz` } })
    } })
    const exchange = (name: string) => exchangePromotionToken(name, new URL('/identity?audience=old', server.url), 'runner-token', server.url)
    const tokens = () => Promise.all(packages.map(async pkg => [pkg.name, await exchange(pkg.name)] as const)).then(entries => new Map(entries))
    try {
      await expect(exchangePromotionToken(packages[0]!.name, foreign.url, 'runner-token', server.url)).rejects.toThrow('GitHub Actions identity endpoint')
      expect(forwarded).toBe(0)
      const first = await tokens()
      await expect(promoteTags(packages, { registry: server.url.href, token: new Map([Array.from(first)[0]!]) })).rejects.toThrow('@stacksjs/support')
      expect(tagWrites).toHaveLength(0)
      expect(await promoteTags(packages, { registry: server.url.href, token: first })).toEqual(['@stacksjs/support@0.75.242: registry HTTP 403'])
      await expect(confirmPublications(packages, server.url.href, 1, 0, 'latest')).rejects.toThrow('@stacksjs/support')
      rejectSupport = false
      expect(await promoteTags(packages, { registry: server.url.href, token: await tokens() })).toEqual([])
      await confirmPublications(packages, server.url.href, 1, 0, 'latest')
      expect(identityRequests).toBe(4)
      expect(new Set(tagWrites.map(([, auth]) => auth)).size).toBe(4)
    }
    finally { server.stop(true); foreign.stop(true) }
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

  it('checks the promotion credential before selecting an initial tag', async () => {
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        expect(new URL(request.url).pathname).toBe('/-/whoami')
        const token = request.headers.get('authorization')
        if (token === 'Bearer valid-token') return Response.json({ username: 'publisher' })
        return new Response(null, { status: token === 'Bearer expired-token' ? 401 : 503 })
      },
    })
    try {
      expect(await npmPublicationTag(' ', server.url.href)).toBe('latest')
      expect(await npmPublicationTag('expired-token', server.url.href)).toBe('latest')
      expect(await npmPublicationTag('valid-token', server.url.href)).toBe('staging')
      await expect(npmPublicationTag('unknown-token', server.url.href)).rejects.toThrow('HTTP 503')
    }
    finally {
      server.stop(true)
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
