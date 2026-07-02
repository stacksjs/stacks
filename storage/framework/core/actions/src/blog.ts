/**
 * BunPress-powered blog.
 *
 * The blog at `/blog` is rendered by BunPress (our docs engine) with a custom
 * Stacks theme — not by the stx view layer. Posts are markdown files in
 * `content/blog/*.md`; BunPress handles markdown → HTML (syntax highlighting,
 * containers, heading anchors, GFM) and wraps it in its themed document shell.
 * We re-skin its VitePress theme to the Stacks brand via `content/blog/.theme.css`
 * and add blog chrome (post header, author card, share, listing cards). RSS +
 * sitemap come from BunPress's own `buildRssFeed` / `buildSitemap`.
 *
 * Two consumers share the same renderers:
 *   - `renderBlog(req)` — dynamic, used by the dev server's onRequest hook.
 *   - `buildBlog({ outDir, baseUrl })` — static, used at deploy time to emit
 *     `dist/blog/**` (see config/cloud.ts), the same way /docs builds.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const CONTENT_DIR = join(process.cwd(), 'content/blog')
const THEME_FILE = join(CONTENT_DIR, '.theme.css')

interface BunPress {
  markdownToHtml: (md: string, root?: string) => Promise<{ html: string, frontmatter: Record<string, any> }>
  wrapInLayout: (content: string, config: any, currentPath: string, layout?: string) => Promise<string>
  buildRssFeed?: (docsDir: string, config: any, rssConfig?: any) => Promise<string>
  buildSitemap?: (docsDir: string, config: any) => Promise<string>
  defaultConfig: any
}

let bunpressPromise: Promise<BunPress | null> | null = null

async function loadBunPress(): Promise<BunPress | null> {
  if (!bunpressPromise) {
    bunpressPromise = (async () => {
      const candidates = [
        join(homedir(), 'Code/Tools/bunpress/packages/bunpress/dist/src/index.js'),
        join(process.cwd(), 'pantry/@stacksjs/bunpress/dist/src/index.js'),
        '@stacksjs/bunpress',
      ]
      for (const entry of candidates) {
        try {
          if (entry.startsWith('@') || existsSync(entry))
            return (await import(entry)) as unknown as BunPress
        }
        catch { /* try next */ }
      }
      return null
    })()
  }
  return bunpressPromise
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}

function escapeXml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&apos;' }[c]!))
}

function postUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/$/, '')}/blog/${slug}`
}

function rssDate(date: string): string {
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toUTCString()
}

function fallbackFeedXml(baseUrl: string): string {
  const origin = baseUrl || 'https://stacksjs.com'
  const posts = listPosts().slice(0, 50)
  const items = posts.map((p) => {
    const url = postUrl(origin, p.slug)

    return `    <item>
      <title>${escapeXml(p.fm.title || p.slug)}</title>
      <link>${escapeXml(url)}</link>
      <guid>${escapeXml(url)}</guid>
      <pubDate>${escapeXml(rssDate(p.fm.date))}</pubDate>
      <description>${escapeXml(p.fm.description || '')}</description>
    </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>The Stacks Blog</title>
    <link>${escapeXml(`${origin}/blog`)}</link>
    <description>Notes from building a full-stack TypeScript framework whose only dependencies are TypeScript and Bun.</description>
${items}
  </channel>
</rss>`
}

function fallbackSitemapXml(baseUrl: string): string {
  const origin = baseUrl || 'https://stacksjs.com'
  const urls = [`${origin}/blog`, ...listPosts().map(p => postUrl(origin, p.slug))]
    .map(url => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

/** Minimal single-line `key: value` frontmatter parser (sufficient for posts). */
function parseFrontmatter(md: string): { data: Record<string, string>, body: string } {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m)
    return { data: {}, body: md }
  const data: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i === -1)
      continue
    const key = line.slice(0, i).trim()
    let val = line.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\'')))
      val = val.slice(1, -1)
    data[key] = val
  }
  return { data, body: m[2] }
}

function formatDate(d: string): string {
  if (!d)
    return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime()))
    return d
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

/**
 * Outdoors chrome injected into every blog page:
 *   - an early (head-ish) script that applies the saved theme before paint and
 *     defines the toggle handler, then
 *   - a fixed 3-way theme switcher (colored / light / dark).
 * Default theme is `colored` (the warm NPS-brochure look — the signature Stacks
 * blog palette); the script only diverges from it when the visitor has
 * previously chosen another, or when a `?theme=` override is present.
 */
function blogChrome(): string {
  return `<script>
    (function () {
      function ok(theme) {
        return theme === 'light' || theme === 'colored' || theme === 'dark'
      }

      var queryTheme = ''
      try {
        queryTheme = new URLSearchParams(location.search).get('theme') || ''
      }
      catch {}

      var savedTheme = ''
      try {
        savedTheme = localStorage.getItem('stacks-blog-theme') || ''
      }
      catch {}

      var theme = ok(queryTheme) ? queryTheme : (ok(savedTheme) ? savedTheme : 'colored')
      document.documentElement.setAttribute('data-theme', theme)
      window.stxBlogTheme = function (nextTheme) {
        try {
          localStorage.setItem('stacks-blog-theme', nextTheme)
        }
        catch {}
        document.documentElement.setAttribute('data-theme', nextTheme)
      }
    })()
  </script>
    <div class="blog-theme-toggle" role="group" aria-label="Theme">
      <button type="button" data-t="colored" title="Park (default)" aria-label="Park theme" onclick="stxBlogTheme('colored')">🌲</button>
      <button type="button" data-t="light" title="Light" aria-label="Light theme" onclick="stxBlogTheme('light')">☀</button>
      <button type="button" data-t="dark" title="Dark" aria-label="Dark theme" onclick="stxBlogTheme('dark')">🌙</button>
    </div>`
}

/** Ridge + river landscape footer that closes out every blog page. */
function blogFooter(): string {
  return `<div class="blog-landscape" aria-hidden="true">
      <span class="ridge"></span>
      <span class="river"></span>
      <p class="colophon">Built with Stacks · TypeScript &amp; Bun · <a href="/blog/feed.xml">RSS</a></p>
    </div>`
}

function blogConfig(bp: BunPress, fm: Record<string, any>) {
  const themeCss = existsSync(THEME_FILE) ? readFileSync(THEME_FILE, 'utf-8') : ''
  const baseCss = (bp.defaultConfig.markdown?.css as string) || ''
  return {
    ...bp.defaultConfig,
    title: fm.title || 'Stacks Blog',
    description: fm.description || 'The official Stacks blog.',
    docsDir: CONTENT_DIR,
    theme: 'vitepress',
    markdown: { ...bp.defaultConfig.markdown, css: `${baseCss}\n${themeCss}` },
    themeConfig: {
      siteTitle: 'Stacks Blog',
      nav: [
        { text: 'Blog', link: '/blog' },
        { text: 'Docs', link: '/docs' },
        { text: 'GitHub', link: 'https://github.com/stacksjs/stacks' },
      ],
    },
  }
}

function listPosts(): { slug: string, fm: Record<string, string> }[] {
  if (!existsSync(CONTENT_DIR))
    return []
  return readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.md'))
    .map((f) => {
      const { data } = parseFrontmatter(readFileSync(join(CONTENT_DIR, f), 'utf-8'))
      return { slug: f.replace(/\.md$/, ''), fm: data }
    })
    // A real post needs a title + date; this skips docs/drafts like STRATEGY.md
    // (and matches what BunPress's RSS collector requires).
    .filter(p => !!p.fm.title && !!p.fm.date)
    .sort((a, b) => {
      // Featured first, then newest date first.
      const fa = a.fm.featured === 'true' ? 1 : 0
      const fb = b.fm.featured === 'true' ? 1 : 0
      if (fa !== fb)
        return fb - fa
      return (b.fm.date || '').localeCompare(a.fm.date || '')
    })
}

// ── HTML/XML builders (shared by the dynamic + static paths) ─────────────────

async function notFoundHtml(bp: BunPress): Promise<string> {
  const body = `
    <a class="blog-back" href="/blog">← All posts</a>
    <div class="blog-404">
      <span class="blog-404-art" aria-hidden="true"></span>
      <h1>You've wandered off the trail</h1>
      <p>This post isn't on the map (or it moved camp). Head back to <a href="/blog">the trailhead</a>.</p>
    </div>`
  return bp.wrapInLayout(blogChrome() + body + blogFooter(), blogConfig(bp, { title: 'Not found' }), '/blog', 'page')
}

/** Full HTML for a single post, or null if the markdown file doesn't exist. */
async function postHtml(bp: BunPress, slug: string, origin: string): Promise<string | null> {
  const file = join(CONTENT_DIR, `${slug}.md`)
  if (!existsSync(file))
    return null

  const raw = readFileSync(file, 'utf-8')
  const { html, frontmatter: fm } = await bp.markdownToHtml(raw, CONTENT_DIR)

  // Only real posts (title + date) are served; docs/drafts in content/blog/
  // (e.g. STRATEGY.md) are not addressable as posts.
  if (!fm.title || !fm.date)
    return null

  const initial = escapeHtml((fm.author || 'S').charAt(0).toUpperCase())
  const header = `
    <a class="blog-back" href="/blog">← All posts</a>
    <div class="blog-post-head">
      <h1>${escapeHtml(fm.title || slug)}</h1>
      <p class="blog-post-meta">
        <span class="author">${escapeHtml(fm.author || 'The Stacks Team')}</span>
        <span class="dot">·</span>
        <time>${escapeHtml(formatDate(fm.date))}</time>
      </p>
      ${fm.poster ? `<figure class="blog-post-poster"><img src="${escapeHtml(fm.poster)}" alt="${escapeHtml(fm.title || '')}"></figure>` : ''}
    </div>`

  const authorCard = fm.authorBio
    ? `<aside class="blog-author-card">
         <div class="avatar">${initial}</div>
         <div><span class="name">${escapeHtml(fm.author || 'The Stacks Team')}</span><p class="bio">${escapeHtml(fm.authorBio)}</p></div>
       </aside>`
    : ''

  const postUrl = `${origin}/blog/${slug}`
  const share = `
    <div class="blog-share">
      <span class="blog-share-label">Share</span>
      <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(postUrl)}&text=${encodeURIComponent(fm.title || '')}" target="_blank" rel="noreferrer">X / Twitter</a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}" target="_blank" rel="noreferrer">LinkedIn</a>
    </div>`

  const others = listPosts().filter(p => p.slug !== slug).slice(0, 3)
  const more = others.length
    ? `<nav class="blog-more">
         <h2>More from the blog</h2>
         <ul>${others.map(p => `<li><a href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.fm.title || p.slug)}</a></li>`).join('')}</ul>
       </nav>`
    : ''

  return bp.wrapInLayout(blogChrome() + header + html + authorCard + share + more + blogFooter(), blogConfig(bp, fm), `/blog/${slug}`, 'page')
}

/** Full HTML for the blog listing. */
async function indexHtml(bp: BunPress): Promise<string> {
  const posts = listPosts()
  const cards = posts.map((p) => {
    const featured = p.fm.featured === 'true'
    const media = p.fm.poster
      ? `<div class="blog-card-media"><img src="${escapeHtml(p.fm.poster)}" alt="" loading="lazy"></div>`
      : ''
    return `<a class="blog-card${featured ? ' is-featured' : ''}" href="/blog/${escapeHtml(p.slug)}">
      ${media}
      <div>
        ${featured ? '<span class="blog-card-flag">Featured</span>' : ''}
        <h2 class="blog-card-title">${escapeHtml(p.fm.title || p.slug)}</h2>
        <p class="blog-card-excerpt">${escapeHtml((p.fm.description || '').slice(0, 180))}</p>
        <div class="blog-card-meta">${escapeHtml(p.fm.author || 'The Stacks Team')} · ${escapeHtml(formatDate(p.fm.date))}</div>
      </div>
    </a>`
  }).join('\n')

  const body = `
    <div class="blog-listing-head">
      <span class="sign" aria-hidden="true"></span>
      <h1>The Stacks Blog</h1>
      <p>Notes from building a full-stack TypeScript framework whose only dependencies are TypeScript and Bun.</p>
    </div>
    <div class="blog-cards">${cards || '<p>No posts yet.</p>'}</div>`

  return bp.wrapInLayout(blogChrome() + body + blogFooter(), blogConfig(bp, { title: 'Blog', description: 'The official Stacks blog.' }), '/blog', 'page')
}

/** RSS feed (BunPress's own builder). `baseUrl` is the site origin (no /blog). */
function feedXml(bp: BunPress, baseUrl: string): Promise<string> {
  const cfg = { ...blogConfig(bp, { title: 'The Stacks Blog' }), sitemap: { enabled: true, baseUrl: `${baseUrl}/blog` } }
  return typeof bp.buildRssFeed === 'function'
    ? bp.buildRssFeed(CONTENT_DIR, cfg, {
        enabled: true,
        title: 'The Stacks Blog',
        description: 'Notes from building a full-stack TypeScript framework whose only dependencies are TypeScript and Bun.',
        maxItems: 50,
      })
    : Promise.resolve(fallbackFeedXml(baseUrl))
}

/** XML sitemap (BunPress's own builder). `baseUrl` is the site origin (no /blog). */
function sitemapXml(bp: BunPress, baseUrl: string): Promise<string> {
  const cfg = { ...blogConfig(bp, { title: 'Blog' }), sitemap: { enabled: true, baseUrl: `${baseUrl}/blog` } }
  return typeof bp.buildSitemap === 'function'
    ? bp.buildSitemap(CONTENT_DIR, cfg)
    : Promise.resolve(fallbackSitemapXml(baseUrl))
}

// ── Dynamic path (dev server onRequest) ──────────────────────────────────────

/**
 * Render a blog request via BunPress, or return null to let the caller handle
 * non-blog paths. Handles the listing, posts, the RSS feed, and the sitemap.
 */
export async function renderBlog(req: Request): Promise<Response | null> {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return null

  const url = new URL(req.url)
  const { pathname } = url
  const isFeed = pathname === '/blog/feed.xml'
  const isSitemap = pathname === '/blog/sitemap.xml'
  const isPage = pathname === '/blog' || pathname === '/blog/' || /^\/blog\/[^/.]+$/.test(pathname)
  if (!isFeed && !isSitemap && !isPage)
    return null // assets, category/tag, etc. → not ours

  const bp = await loadBunPress()
  if (!bp)
    return null // BunPress unavailable — fall back to whatever the caller does

  const html = (s: string, status = 200) => new Response(s, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })

  if (isFeed)
    return new Response(await feedXml(bp, url.origin), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
  if (isSitemap)
    return new Response(await sitemapXml(bp, url.origin), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
  if (pathname === '/blog' || pathname === '/blog/')
    return html(await indexHtml(bp))

  const slug = pathname.replace(/^\/blog\//, '').replace(/\/$/, '')
  const post = await postHtml(bp, slug, url.origin)
  return post ? html(post) : html(await notFoundHtml(bp), 404)
}

// ── Static path (deploy-time build → dist/blog) ──────────────────────────────

/**
 * Build the blog to a static directory the same way /docs is built (see
 * config/cloud.ts). Emits clean-URL pages (`<slug>/index.html`), the listing,
 * the RSS feed, and the sitemap. `baseUrl` is the deployed site origin
 * (e.g. https://stacksjs.com) — used for absolute feed/sitemap/share URLs.
 */
export async function buildBlog(options: { outDir: string, baseUrl?: string } = { outDir: 'dist/blog' }): Promise<void> {
  const outDir = options.outDir || 'dist/blog'
  const baseUrl = (options.baseUrl || '').replace(/\/$/, '')

  const bp = await loadBunPress()
  if (!bp)
    throw new Error('[blog] BunPress not found — cannot build the blog.')

  mkdirSync(outDir, { recursive: true })
  const write = (rel: string, content: string) => {
    const target = join(outDir, rel)
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, content, 'utf-8')
  }

  // Listing
  write('index.html', await indexHtml(bp))

  // Posts — clean-URL directories (`<slug>/index.html`).
  const posts = listPosts()
  for (const p of posts) {
    const html = await postHtml(bp, p.slug, baseUrl)
    if (html)
      write(join(p.slug, 'index.html'), html)
  }

  // SEO
  write('feed.xml', await feedXml(bp, baseUrl))
  write('sitemap.xml', await sitemapXml(bp, baseUrl))

  // eslint-disable-next-line no-console
  console.log(`[blog] built ${posts.length} post(s) + listing, feed.xml, sitemap.xml → ${outDir}`)
}
