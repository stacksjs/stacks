/**
 * BunPress-powered blog.
 *
 * The blog at `/blog` is rendered by BunPress (our docs engine) with a custom
 * Stacks theme — not by the stx view layer. Posts are markdown files in
 * `content/blog/*.md`; BunPress handles markdown → HTML (syntax highlighting,
 * containers, heading anchors, GFM) and wraps it in its themed document shell.
 * We re-skin its VitePress theme via `content/blog/.theme.css` and add blog
 * chrome (post header, author card, share, listing cards). RSS + sitemap come
 * from BunPress's own `buildRssFeed` / `buildSitemap`.
 *
 * Branding (titles, nav, author fallback, colophon, theme modes) is read from
 * the app's `config/blog.ts`; the defaults below match the Stacks blog so an
 * unconfigured app renders exactly as before.
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

type BlogThemeMode = 'colored' | 'light' | 'dark'

/** Branding knobs read from `config/blog.ts` (all optional there). */
interface BlogSiteConfig {
  title: string
  description: string
  /** Short title used in the layout nav; defaults to `title`. */
  siteTitle: string
  /** Fallback post author when frontmatter has none. */
  author: string
  /** Canonical site origin for feed/sitemap URLs when no request origin exists. */
  url: string
  nav: { text: string, link: string }[]
  /** Which modes the theme toggle offers. */
  themes: BlogThemeMode[]
  defaultTheme: BlogThemeMode
  /** Raw HTML for the footer colophon line. */
  colophon: string
  /** Empty-state heading shown when no posts exist yet. */
  emptyTitle: string
  /** Empty-state copy shown under the heading (plain text). */
  emptyText: string
}

const STACKS_DEFAULTS: BlogSiteConfig = {
  title: 'The Stacks Blog',
  description: 'Notes from building a full-stack TypeScript framework whose only dependencies are TypeScript and Bun.',
  siteTitle: 'Stacks Blog',
  author: 'The Stacks Team',
  url: 'https://stacksjs.com',
  nav: [
    { text: 'Blog', link: '/blog' },
    { text: 'Docs', link: '/docs' },
    { text: 'GitHub', link: 'https://github.com/stacksjs/stacks' },
  ],
  themes: ['colored', 'light', 'dark'],
  defaultTheme: 'colored',
  colophon: 'Built with Stacks · TypeScript &amp; Bun · <a href="/blog/feed.xml">RSS</a>',
  emptyTitle: 'No posts yet',
  emptyText: 'The first one is in the works. Leave your email and it will land in your inbox the moment it ships.',
}

let sitePromise: Promise<BlogSiteConfig> | null = null

/** Load `config/blog.ts` and merge over the Stacks defaults (cached). */
function site(): Promise<BlogSiteConfig> {
  if (!sitePromise) {
    sitePromise = (async () => {
      try {
        const mod = await import(join(process.cwd(), 'config/blog.ts'))
        const cfg = (mod.default ?? {}) as Partial<BlogSiteConfig>
        const merged: BlogSiteConfig = { ...STACKS_DEFAULTS, ...cfg }
        if (!cfg.siteTitle && cfg.title)
          merged.siteTitle = cfg.title
        return merged
      }
      catch {
        return STACKS_DEFAULTS
      }
    })()
  }
  return sitePromise
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

function rssDate(date?: string): string {
  if (!date)
    return ''
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toUTCString()
}

async function fallbackFeedXml(baseUrl: string): Promise<string> {
  const cfg = await site()
  const origin = baseUrl || cfg.url
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
    <title>${escapeXml(cfg.title)}</title>
    <link>${escapeXml(`${origin}/blog`)}</link>
    <description>${escapeXml(cfg.description)}</description>
${items}
  </channel>
</rss>`
}

async function fallbackSitemapXml(baseUrl: string): Promise<string> {
  const cfg = await site()
  const origin = baseUrl || cfg.url
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
  const frontmatter = m[1] ?? ''
  for (const line of frontmatter.split('\n')) {
    const i = line.indexOf(':')
    if (i === -1)
      continue
    const key = line.slice(0, i).trim()
    let val = line.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\'')))
      val = val.slice(1, -1)
    data[key] = val
  }
  return { data, body: m[2] ?? '' }
}

function formatDate(d?: string): string {
  if (!d)
    return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime()))
    return d
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

const THEME_BUTTONS: Record<BlogThemeMode, { label: string, glyph: string }> = {
  colored: { label: 'Park theme', glyph: '🌲' },
  light: { label: 'Light theme', glyph: '☀' },
  dark: { label: 'Dark theme', glyph: '🌙' },
}

/**
 * Chrome injected into every blog page:
 *   - an early (head-ish) script that applies the saved theme before paint and
 *     defines the toggle handler, then
 *   - a fixed theme switcher offering the configured modes.
 * The default mode comes from config (`defaultTheme`); the script only diverges
 * from it when the visitor has previously chosen another mode, or when a
 * `?theme=` override is present.
 */
async function blogChrome(): Promise<string> {
  const cfg = await site()
  const modes = cfg.themes.length ? cfg.themes : STACKS_DEFAULTS.themes
  const fallback = modes.includes(cfg.defaultTheme) ? cfg.defaultTheme : modes[0]
  const buttons = modes.map(m => `<button type="button" data-t="${m}" title="${THEME_BUTTONS[m].label}" aria-label="${THEME_BUTTONS[m].label}" onclick="stxBlogTheme('${m}')">${THEME_BUTTONS[m].glyph}</button>`).join('\n      ')
  const toggle = modes.length > 1
    ? `<div class="blog-theme-toggle" role="group" aria-label="Theme">
      ${buttons}
    </div>`
    : ''

  return `<script>
    (function () {
      var modes = ${JSON.stringify(modes)}
      function ok(theme) {
        return modes.indexOf(theme) !== -1
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

      var theme = ok(queryTheme) ? queryTheme : (ok(savedTheme) ? savedTheme : ${JSON.stringify(fallback)})
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
    ${toggle}`
}

/** Landscape footer that closes out every blog page (shapes styled by the theme CSS). */
async function blogFooter(): Promise<string> {
  const cfg = await site()
  return `<div class="blog-landscape" aria-hidden="true">
      <span class="ridge"></span>
      <span class="river"></span>
      <p class="colophon">${cfg.colophon}</p>
    </div>`
}

async function blogConfig(bp: BunPress, fm: Record<string, any>) {
  const cfg = await site()
  const themeCss = existsSync(THEME_FILE) ? readFileSync(THEME_FILE, 'utf-8') : ''
  const baseCss = (bp.defaultConfig.markdown?.css as string) || ''
  return {
    ...bp.defaultConfig,
    title: fm.title || cfg.title,
    description: fm.description || cfg.description,
    docsDir: CONTENT_DIR,
    theme: 'vitepress',
    markdown: { ...bp.defaultConfig.markdown, css: `${baseCss}\n${themeCss}` },
    themeConfig: {
      siteTitle: cfg.siteTitle,
      nav: cfg.nav,
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
      <h1>Nothing here</h1>
      <p>This post doesn't exist (or it moved). Head back to <a href="/blog">all posts</a>.</p>
    </div>`
  return bp.wrapInLayout(await blogChrome() + body + await blogFooter(), await blogConfig(bp, { title: 'Not found' }), '/blog', 'page')
}

/** Full HTML for a single post, or null if the markdown file doesn't exist. */
async function postHtml(bp: BunPress, slug: string, origin: string): Promise<string | null> {
  const cfg = await site()
  const file = join(CONTENT_DIR, `${slug}.md`)
  if (!existsSync(file))
    return null

  const raw = readFileSync(file, 'utf-8')
  const { html, frontmatter: fm } = await bp.markdownToHtml(raw, CONTENT_DIR)

  // Only real posts (title + date) are served; docs/drafts in content/blog/
  // (e.g. STRATEGY.md) are not addressable as posts.
  if (!fm.title || !fm.date)
    return null

  const author = fm.author || cfg.author
  const initial = escapeHtml(author.charAt(0).toUpperCase())
  const header = `
    <a class="blog-back" href="/blog">← All posts</a>
    <div class="blog-post-head">
      <h1>${escapeHtml(fm.title || slug)}</h1>
      <p class="blog-post-meta">
        <span class="author">${escapeHtml(author)}</span>
        <span class="dot">·</span>
        <time>${escapeHtml(formatDate(fm.date))}</time>
      </p>
      ${fm.poster ? `<figure class="blog-post-poster"><img src="${escapeHtml(fm.poster)}" alt="${escapeHtml(fm.title || '')}"></figure>` : ''}
    </div>`

  const authorCard = fm.authorBio
    ? `<aside class="blog-author-card">
        <div class="avatar">${initial}</div>
        <div><span class="name">${escapeHtml(author)}</span><p class="bio">${escapeHtml(fm.authorBio)}</p></div>
      </aside>`
    : ''

  const shareUrl = `${origin}/blog/${slug}`
  const share = `
    <div class="blog-share">
      <span class="blog-share-label">Share</span>
      <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(fm.title || '')}" target="_blank" rel="noreferrer">X / Twitter</a>
      <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}" target="_blank" rel="noreferrer">LinkedIn</a>
    </div>`

  const others = listPosts().filter(p => p.slug !== slug).slice(0, 3)
  const more = others.length
    ? `<nav class="blog-more">
        <h2>More from the blog</h2>
        <ul>${others.map(p => `<li><a href="/blog/${escapeHtml(p.slug)}">${escapeHtml(p.fm.title || p.slug)}</a></li>`).join('')}</ul>
      </nav>`
    : ''

  return bp.wrapInLayout(await blogChrome() + header + html + authorCard + share + more + await blogFooter(), await blogConfig(bp, fm), `/blog/${slug}`, 'page')
}

/** Full HTML for the blog listing. */
async function indexHtml(bp: BunPress): Promise<string> {
  const cfg = await site()
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
        <div class="blog-card-meta">${escapeHtml(p.fm.author || cfg.author)} · ${escapeHtml(formatDate(p.fm.date))}</div>
      </div>
    </a>`
  }).join('\n')

  // Empty state doubles as an email-capture moment: every Stacks app ships the
  // public `/api/email/subscribe` endpoint, so the form works out of the box.
  const emptyState = `
    <div class="blog-empty">
      <h2>${escapeHtml(cfg.emptyTitle)}</h2>
      <p>${escapeHtml(cfg.emptyText)}</p>
      <form class="blog-subscribe" method="POST" action="/api/email/subscribe">
        <input type="email" name="email" placeholder="you@example.com" autocomplete="email" aria-label="Email address" required>
        <input type="hidden" name="source" value="blog-empty">
        <button type="submit">Subscribe</button>
        <p class="blog-form-note" role="status" aria-live="polite"></p>
      </form>
    </div>
    <script>
      (function () {
        var form = document.querySelector('.blog-subscribe')
        if (!form) return
        var note = form.querySelector('.blog-form-note')
        var button = form.querySelector('button[type="submit"]')
        var say = function (text) { if (note) note.textContent = text }
        form.addEventListener('submit', function (event) {
          event.preventDefault()
          var input = form.querySelector('input[name="email"]')
          if (!input || !input.value) { say('Enter an email address first.'); return }
          if (button) button.disabled = true
          say('Subscribing...')
          var body = new URLSearchParams()
          body.set('email', input.value)
          body.set('source', 'blog-empty')
          fetch('/api/email/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          })
            .then(function (res) { return res.json().catch(function () { return {} }) })
            .then(function (data) {
              if (data && data.success) {
                say(data.message === 'Already subscribed' ? 'You are already on the list.' : 'Subscribed. Check your inbox to confirm.')
                form.reset()
              }
              else {
                say((data && data.message) || 'Something went wrong. Try again.')
              }
            })
            .catch(function () { say('Network error. Try again in a moment.') })
            .finally(function () { if (button) button.disabled = false })
        })
      })()
    </script>`

  const body = `
    <div class="blog-listing-head">
      <span class="sign" aria-hidden="true"></span>
      <h1>${escapeHtml(cfg.title)}</h1>
      <p>${escapeHtml(cfg.description)}</p>
    </div>
    <div class="blog-cards">${cards || emptyState}</div>`

  return bp.wrapInLayout(await blogChrome() + body + await blogFooter(), await blogConfig(bp, { title: cfg.title, description: cfg.description }), '/blog', 'page')
}

/** RSS feed (BunPress's own builder). `baseUrl` is the site origin (no /blog). */
async function feedXml(bp: BunPress, baseUrl: string): Promise<string> {
  const site_ = await site()
  const cfg = { ...await blogConfig(bp, { title: site_.title }), sitemap: { enabled: true, baseUrl: `${baseUrl}/blog` } }
  return typeof bp.buildRssFeed === 'function'
    ? bp.buildRssFeed(CONTENT_DIR, cfg, {
        enabled: true,
        title: site_.title,
        description: site_.description,
        maxItems: 50,
      })
    : fallbackFeedXml(baseUrl)
}

/** XML sitemap (BunPress's own builder). `baseUrl` is the site origin (no /blog). */
async function sitemapXml(bp: BunPress, baseUrl: string): Promise<string> {
  const cfg = { ...await blogConfig(bp, { title: 'Blog' }), sitemap: { enabled: true, baseUrl: `${baseUrl}/blog` } }
  return typeof bp.buildSitemap === 'function'
    ? bp.buildSitemap(CONTENT_DIR, cfg)
    : fallbackSitemapXml(baseUrl)
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

/**
 * RSS + sitemap for an stx-native blog. When an app renders /blog with its own
 * stx views (so BunPress is skipped for the HTML pages), it still wants
 * /blog/feed.xml and /blog/sitemap.xml — these are generated straight from the
 * `content/blog/*.md` frontmatter with NO BunPress dependency, so they work in
 * dev and production alike. Returns null for any non-feed path (the stx page
 * layer then handles /blog and /blog/<slug>). Absolute URLs use the configured
 * site url (blog config), never the loopback request origin.
 */
export async function renderBlogFeed(req: Request): Promise<Response | null> {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return null
  const { pathname } = new URL(req.url)
  if (pathname === '/blog/feed.xml')
    return new Response(await fallbackFeedXml(''), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
  if (pathname === '/blog/sitemap.xml')
    return new Response(await fallbackSitemapXml(''), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
  return null
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
  const baseUrl = (options.baseUrl || (await site()).url).replace(/\/$/, '')

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
