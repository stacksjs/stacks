/**
 * `/sitemap.xml` and `/robots.txt` generated from an app's views (../src/seo.ts).
 *
 * The failure this replaces is silent by construction: a hand-written sitemap
 * in `public/` goes stale the day a page is added, and a crawler never reports
 * the pages it was not told about. So the tests pin both halves - which views
 * are listed, and which are not and why - against a real directory of views.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  buildRobotsTxt,
  buildSitemapXml,
  collectSitemapEntries,
  createSiteSeoHandler,
  declaresNoindex,
  describeSeoAtBoot,
  isDisallowedByRobots,
  isErrorViewPath,
  pathMatchesExclude,
  pathsMissingFromSitemap,
  requiresAuth,
  resolveSeoOrigin,
  scanViewSitemapEntries,
  sitemapLocs,
} from '../src/seo'

let root: string

function write(rel: string, content = '<div>page</div>'): void {
  const file = join(root, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-seo-'))
  write('resources/views/index.stx')
  write('resources/views/pricing.stx')
  write('resources/views/docs/index.stx')
  write('resources/views/404.stx')
  write('resources/views/errors/500.stx')
  write('resources/views/checkout/[plan].stx')
  write('resources/views/layouts/default.stx')
  write('resources/views/components/Card.stx')
  write('resources/views/emails/welcome.stx')
  write('resources/views/_draft.stx')
  write('resources/views/thanks.stx', '<script server>\nconst noindex = true\n</script>\n<div>thanks</div>')
  write('resources/views/dashboard.stx', '<head><meta name="robots" content="noindex, nofollow"></head>')
  write('resources/views/account.stx', '<script server>\ndefinePageMeta({ middleware: [\'auth\'] })\n</script>')
  write('resources/views/admin/index.stx')
  write('content/blog/hello.md', '---\ntitle: Hello\ndate: 2026-01-01\n---\nBody')
  write('content/blog/wip.md', '---\ntitle: WIP\ndate: 2026-02-01\ndraft: true\n---\nBody')
})

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('declaresNoindex', () => {
  it('reads a robots meta tag in either attribute order', () => {
    expect(declaresNoindex('<meta name="robots" content="noindex">')).toBe(true)
    expect(declaresNoindex('<meta content="noindex, nofollow" name="robots" />')).toBe(true)
    expect(declaresNoindex('<meta name="googlebot" content="noindex">')).toBe(true)
  })

  it('reads a head object and the noindex flag a head partial consumes', () => {
    expect(declaresNoindex(`useSeoMeta({ robots: 'noindex, follow' })`)).toBe(true)
    expect(declaresNoindex('const noindex = true')).toBe(true)
    expect(declaresNoindex('definePageMeta({ sitemap: false })')).toBe(true)
  })

  it('does not fire on an indexable page, a false flag or a comment', () => {
    expect(declaresNoindex('<meta name="robots" content="index, follow">')).toBe(false)
    expect(declaresNoindex('const noindex = false')).toBe(false)
    expect(declaresNoindex('<!-- <meta name="robots" content="noindex"> -->')).toBe(false)
    expect(declaresNoindex('// const noindex = true')).toBe(false)
    // A conditional in a shared partial is not this page saying noindex.
    expect(declaresNoindex(`robots: hidden ? 'noindex' : 'index, follow'`)).toBe(false)
    // `https://` must not be read as the start of a line comment.
    expect(declaresNoindex('<a href="https://x.com">x</a><meta name="robots" content="noindex">')).toBe(true)
  })
})

describe('page classification', () => {
  it('recognises the auth page middleware', () => {
    expect(requiresAuth(`definePageMeta({ middleware: ['auth'] })`)).toBe(true)
    expect(requiresAuth(`definePageMeta({ middleware: 'auth' })`)).toBe(true)
    expect(requiresAuth(`definePageMeta({ middleware: ['guest'] })`)).toBe(false)
  })

  it('recognises error and holding pages', () => {
    expect(isErrorViewPath('/404')).toBe(true)
    expect(isErrorViewPath('/errors/whatever')).toBe(true)
    expect(isErrorViewPath('/coming-soon')).toBe(true)
    expect(isErrorViewPath('/pricing')).toBe(false)
  })

  it('matches config excludes exactly or by subtree', () => {
    expect(pathMatchesExclude('/admin', '/admin/')).toBe(true)
    expect(pathMatchesExclude('/admin/users', '/admin/')).toBe(true)
    expect(pathMatchesExclude('/administrator', '/admin/')).toBe(false)
    expect(pathMatchesExclude('/admin/users', '/admin*')).toBe(true)
    expect(pathMatchesExclude('/admin/users', '/admin')).toBe(false)
  })

  it('applies robots.txt precedence: longest rule wins, Allow wins a tie', () => {
    const group = { allow: ['/', '/api/public'], disallow: ['/api/', '/thanks', '/*.pdf$'] }
    expect(isDisallowedByRobots('/api/users', group)).toBe(true)
    expect(isDisallowedByRobots('/api/public/x', group)).toBe(false)
    expect(isDisallowedByRobots('/thanks', group)).toBe(true)
    expect(isDisallowedByRobots('/files/a.pdf', group)).toBe(true)
    expect(isDisallowedByRobots('/files/a.pdf.html', group)).toBe(false)
    expect(isDisallowedByRobots('/pricing', group)).toBe(false)
  })
})

describe('scanViewSitemapEntries', () => {
  it('lists static pages and says why every other view was skipped', async () => {
    const scan = await scanViewSitemapEntries(join(root, 'resources/views'), { sitemap: { exclude: ['/admin/'] } })

    expect(scan.entries.map(entry => entry.loc)).toEqual(['/', '/docs', '/pricing'])
    expect(scan.entries[0]!.priority).toBe(1)
    expect(scan.entries[0]!.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const reasons = Object.fromEntries(scan.skipped.map(skip => [skip.path, skip.reason]))
    expect(reasons).toMatchObject({
      '/404': 'error-page',
      '/errors/500': 'error-page',
      '/checkout/[plan]': 'dynamic',
      '/layouts/default': 'non-page',
      '/components/Card': 'non-page',
      '/emails/welcome': 'non-page',
      '/_draft': 'non-page',
      '/thanks': 'noindex',
      '/dashboard': 'noindex',
      '/account': 'auth',
      '/admin': 'excluded',
    })
  })

  it('leaves out a page robots.txt disallows', async () => {
    const scan = await scanViewSitemapEntries(join(root, 'resources/views'), { robots: { disallow: ['/pricing'] } })
    expect(scan.skipped).toContainEqual({ path: '/pricing', reason: 'disallowed' })
  })

  it('is empty for an app with no views', async () => {
    expect(await scanViewSitemapEntries(join(root, 'missing'))).toEqual({ entries: [], skipped: [] })
  })
})

describe('collectSitemapEntries', () => {
  it('merges the blog and config into one list, each path once', async () => {
    const entries = await collectSitemapEntries({
      root,
      origin: 'https://example.com',
      seo: {
        sitemap: {
          include: ['/checkout/monthly', { loc: '/pricing', priority: 0.9 }, 'https://example.com/extra'],
          entries: async () => ['/products/mug', '/admin/secret'],
          exclude: ['/admin/'],
        },
        robots: { disallow: ['/checkout/'] },
      },
    })

    const paths = entries.map(entry => entry.loc)
    // Published posts only: the draft never appears.
    expect(paths).toContain('/blog')
    expect(paths).toContain('/blog/hello')
    expect(paths).not.toContain('/blog/wip')
    expect(paths).toContain('/products/mug')
    expect(paths).toContain('https://example.com/extra')
    // Config cannot list what exclude or robots.txt keeps out.
    expect(paths).not.toContain('/checkout/monthly')
    expect(paths).not.toContain('/admin/secret')
    // Restating a view's path overrides its entry rather than duplicating it.
    expect(entries.filter(entry => entry.loc === '/pricing')).toEqual([expect.objectContaining({ priority: 0.9 })])
  })

  it('survives a failing entries() and lists the rest', async () => {
    const entries = await collectSitemapEntries({
      root,
      origin: '',
      seo: { sitemap: { entries: () => { throw new Error('no database') } } },
    })
    expect(entries.map(entry => entry.loc)).toContain('/pricing')
  })

  it('is empty when the sitemap is turned off', async () => {
    expect(await collectSitemapEntries({ root, origin: '', seo: { sitemap: false } })).toEqual([])
  })
})

describe('the generated files', () => {
  it('writes absolute URLs, and a lastmod only where one is known', async () => {
    const xml = await buildSitemapXml({ root, origin: 'https://example.com' })
    expect(sitemapLocs(xml)).toContain('https://example.com/pricing')
    expect(sitemapLocs(xml)).toContain('https://example.com/blog/hello')
    // The blog post has no file date to offer, so it carries none rather than today's.
    const post = xml.slice(xml.indexOf('https://example.com/blog/hello'))
    expect(post.slice(0, post.indexOf('</url>'))).not.toContain('<lastmod>')
  })

  it('robots.txt disallows the API and the app\'s paths, and names the sitemap', () => {
    const txt = buildRobotsTxt({
      origin: 'https://example.com',
      seo: { robots: { disallow: ['/checkout/', '/thanks'], rules: [{ userAgent: 'GPTBot', disallow: ['/'] }] } },
    })
    expect(txt).toContain('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /checkout/\nDisallow: /thanks')
    expect(txt).toContain('User-agent: GPTBot\nDisallow: /')
    expect(txt).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('robots.txt names no sitemap when the sitemap is off', () => {
    expect(buildRobotsTxt({ origin: 'https://example.com', seo: { sitemap: false } })).not.toContain('Sitemap:')
  })
})

describe('resolveSeoOrigin', () => {
  it('prefers seo.origin, then APP_URL, then the request', () => {
    const request = new Request('http://localhost:3000/sitemap.xml')
    expect(resolveSeoOrigin({ seo: { origin: 'https://a.com' }, appUrl: 'b.com', request })).toBe('https://a.com')
    expect(resolveSeoOrigin({ appUrl: 'b.com', request })).toBe('https://b.com')
    expect(resolveSeoOrigin({ appUrl: 'localhost', request })).toBe('http://localhost:3000')
  })

  it('never bakes in an undecrypted APP_URL', () => {
    const request = new Request('http://127.0.0.1:3000/', { headers: { 'x-forwarded-host': 'site.com', 'x-forwarded-proto': 'https' } })
    expect(resolveSeoOrigin({ appUrl: 'encrypted:tLq7abc==', request })).toBe('https://site.com')
  })
})

describe('createSiteSeoHandler', () => {
  it('answers only /sitemap.xml and /robots.txt, for GET and HEAD', async () => {
    const handle = createSiteSeoHandler({ root, appUrl: 'example.com' })
    expect(await handle(new Request('http://x/pricing'))).toBeNull()
    expect(await handle(new Request('http://x/sitemap.xml', { method: 'POST' }))).toBeNull()

    const sitemap = await handle(new Request('http://x/sitemap.xml'))
    expect(sitemap!.headers.get('content-type')).toContain('application/xml')
    expect(await sitemap!.text()).toContain('https://example.com/pricing')

    const head = await handle(new Request('http://x/robots.txt', { method: 'HEAD' }))
    expect(head!.status).toBe(200)
    expect(await head!.text()).toBe('')
  })

  it('steps aside for a hand-written file unless told to replace it', async () => {
    write('public/robots.txt', 'User-agent: *\nDisallow:\n')
    try {
      expect(await createSiteSeoHandler({ root })(new Request('http://x/robots.txt'))).toBeNull()
      const replaced = await createSiteSeoHandler({ root, seo: { handwritten: 'replace' } })(new Request('http://x/robots.txt'))
      expect(await replaced!.text()).toContain('Generated by Stacks')
    }
    finally {
      rmSync(join(root, 'public'), { recursive: true, force: true })
    }
  })

  it('serves nothing for a file the app turned off', async () => {
    const handle = createSiteSeoHandler({ root, seo: { sitemap: false, robots: false } })
    expect(await handle(new Request('http://x/sitemap.xml'))).toBeNull()
    expect(await handle(new Request('http://x/robots.txt'))).toBeNull()
  })

  it('lists a new page on the next request when not caching', async () => {
    const handle = createSiteSeoHandler({ root, appUrl: 'example.com', cacheTtlMs: 0 })
    expect(await (await handle(new Request('http://x/sitemap.xml')))!.text()).not.toContain('/changelog')
    write('resources/views/changelog.stx')
    try {
      expect(await (await handle(new Request('http://x/sitemap.xml')))!.text()).toContain('https://example.com/changelog')
    }
    finally {
      rmSync(join(root, 'resources/views/changelog.stx'))
    }
  })
})

describe('describeSeoAtBoot', () => {
  it('names the pages a hand-written sitemap is missing', async () => {
    write('public/sitemap.xml', '<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/docs/</loc></url></urlset>')
    write('public/robots.txt', 'User-agent: *\nAllow: /\n')
    try {
      const notes = await describeSeoAtBoot({ root })
      expect(notes[0]).toContain('does not list')
      expect(notes[0]).toContain('/pricing')
      expect(notes[0]).not.toContain('/docs,')
      expect(notes[1]).toContain('names no Sitemap')
      expect(await describeSeoAtBoot({ root, seo: { handwritten: 'replace' } })).toEqual([])
    }
    finally {
      rmSync(join(root, 'public'), { recursive: true, force: true })
    }
  })

  it('compares paths, not origins or trailing slashes', () => {
    const xml = '<urlset><url><loc>https://other.com/a/</loc></url><url><loc>/b</loc></url></urlset>'
    expect(pathsMissingFromSitemap(xml, [{ loc: '/a' }, { loc: '/b' }, { loc: '/c' }])).toEqual(['/c'])
  })
})
