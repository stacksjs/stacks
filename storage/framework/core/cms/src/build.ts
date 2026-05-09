import type { BlogConfig } from '../../../../config/blog'
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { path as p } from '@stacksjs/path'

export interface BuildBlogOptions {
  config: BlogConfig
  outDir: string
}

interface PostRow {
  id: number
  title: string
  slug?: string | null
  content: string
  body?: string | null
  excerpt?: string | null
  poster?: string | null
  status: string
  published_at?: string | null
  views?: number | null
  is_featured?: number | null
  author_id?: number | null
  created_at?: string | null
  updated_at?: string | null
}

interface AuthorRow {
  id: number
  name: string
  email: string
  bio?: string | null
  avatar?: string | null
  social_links?: string | null
}

function getSlug(post: PostRow): string {
  if (post.slug && typeof post.slug === 'string' && post.slug !== 'null') {
    return post.slug
  }
  return `post-${post.id}`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeXml(str: string): string {
  return escapeHtml(str)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatRssDate(dateStr: string): string {
  return new Date(dateStr).toUTCString()
}

function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length
  return Math.max(1, Math.ceil(words / 200))
}

function renderMarkdownish(text: string): string {
  // Simple markdown-like rendering for paragraphs, headings, code blocks, bold, links
  const lines = text.split('\n')
  const result: string[] = []
  let inCodeBlock = false
  let codeBuffer: string[] = []
  let paragraphBuffer: string[] = []

  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join(' ')
      if (text.trim()) {
        result.push(`<p>${inlineFormat(text.trim())}</p>`)
      }
      paragraphBuffer = []
    }
  }

  function inlineFormat(str: string): string {
    // Bold: **text**
    str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Inline code: `text`
    str = str.replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links: [text](url)
    str = str.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    return str
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        result.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
        codeBuffer = []
        inCodeBlock = false
      } else {
        flushParagraph()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeBuffer.push(line)
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      continue
    }

    if (line.startsWith('## ')) {
      flushParagraph()
      result.push(`<h2>${inlineFormat(escapeHtml(line.slice(3)))}</h2>`)
    } else if (line.startsWith('### ')) {
      flushParagraph()
      result.push(`<h3>${inlineFormat(escapeHtml(line.slice(4)))}</h3>`)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph()
      result.push(`<ul><li>${inlineFormat(escapeHtml(line.slice(2)))}</li></ul>`)
    } else {
      paragraphBuffer.push(escapeHtml(line))
    }
  }

  if (inCodeBlock && codeBuffer.length) {
    result.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
  }
  flushParagraph()

  // Merge consecutive <ul> elements
  return result.join('\n').replace(/<\/ul>\n<ul>/g, '\n')
}

function blogFontFaces(fontPath = '/assets/fonts/nps'): string {
  return `@font-face {
      font-family: 'Campmate Script';
      src: url('${fontPath}/CampmateScript-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Sequoia Sans';
      src: url('${fontPath}/SequoiaSans-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Switchback';
      src: url('${fontPath}/Switchback-Regular.woff2') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }`
}

function copyBlogFonts(outDir: string): void {
  const sourceDir = p.frameworkPath('defaults/resources/assets/fonts/nps')
  if (!existsSync(sourceDir))
    return

  const targetDir = join(outDir, 'assets', 'fonts', 'nps')
  ensureDir(targetDir)

  for (const file of readdirSync(sourceDir)) {
    if (file.endsWith('.woff2'))
      copyFileSync(join(sourceDir, file), join(targetDir, file))
  }
}

function copyBlogImages(outDir: string): void {
  const sourceDir = p.frameworkPath('defaults/resources/assets/images')
  if (!existsSync(sourceDir))
    return

  const targetDir = join(outDir, 'assets', 'images')
  ensureDir(targetDir)

  for (const file of readdirSync(sourceDir)) {
    if (file.endsWith('.svg'))
      copyFileSync(join(sourceDir, file), join(targetDir, file))
  }
}

function sqliteDatabasePath(): string {
  const configuredPath = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
  return configuredPath.startsWith('/') ? configuredPath : p.projectPath(configuredPath)
}

function shouldUseLocalSqlite(): boolean {
  return (process.env.DB_CONNECTION || 'sqlite') === 'sqlite' && existsSync(sqliteDatabasePath())
}

async function queryLocalSqlite<T>(sql: string): Promise<T[] | null> {
  if (!shouldUseLocalSqlite())
    return null

  const { Database } = await import('bun:sqlite')
  const sqlite = new Database(sqliteDatabasePath(), { readonly: true })

  try {
    return sqlite.query(sql).all() as T[]
  } finally {
    sqlite.close()
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`CMS database query timed out after ${ms}ms`)), ms)
      }),
    ])
  } finally {
    if (timeout)
      clearTimeout(timeout)
  }
}

async function fetchPublishedPosts(): Promise<PostRow[]> {
  const sqlitePosts = await queryLocalSqlite<PostRow>(
    'select * from posts where status = \'published\' order by published_at desc',
  )
  if (sqlitePosts)
    return sqlitePosts

  const { db } = await import('@stacksjs/database')
  return await withTimeout(
    db
      .selectFrom('posts')
      .where('status', '=', 'published')
      .orderBy('published_at', 'desc')
      .selectAll()
      .execute() as Promise<PostRow[]>,
    3000,
  )
}

async function fetchAuthors(): Promise<AuthorRow[]> {
  const sqliteAuthors = await queryLocalSqlite<AuthorRow>('select * from authors order by created_at desc')
  if (sqliteAuthors)
    return sqliteAuthors

  const { db } = await import('@stacksjs/database')
  return await withTimeout(
    db
      .selectFrom('authors')
      .selectAll()
      .execute() as Promise<AuthorRow[]>,
    3000,
  )
}

function generateLayout(config: BlogConfig, title: string, content: string, _options?: { isPost?: boolean }): string {
  const pageTitle = title === config.title ? config.title : `${escapeHtml(title)} | ${escapeHtml(config.title)}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${escapeHtml(config.description)}">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(config.title)}" href="/feed.xml">
  <style>
    ${blogFontFaces()}

    :root {
      --primary: ${config.theme.primaryColor};
      --primary-hover: #24472d;
      --primary-soft: #e4ead8;
      --primary-deep: #18351f;
      --on-primary: #fff7e7;
      --on-primary-muted: #f3dfbd;
      --accent: #b7792d;
      --accent-hover: #96621f;
      --accent-strong: #8b5316;
      --accent-soft: #f5dfb8;
      --river: #4e8f88;
      --river-soft: #cfe8db;
      --canopy: #326d43;
      --post-hover-border: #b7792d;
      --newsletter-border: #6e8f5f;
      --newsletter-bg: #2d5938;
      --newsletter-bg-end: #18351f;
      --bg: #f7f0e3;
      --paper: #fffaf0;
      --bg-soft: #efe4d1;
      --bg-muted: #eadbc1;
      --text: #273128;
      --text-light: #56624f;
      --text-lighter: #7d806f;
      --border: #d5c5a6;
      --shadow: 0 14px 32px -24px rgba(53, 39, 19, 0.55);
      --max-width: 820px;
      --radius: 8px;
      --focus-ring: 0 0 0 3px rgba(245, 223, 184, 0.45);
      --font-display: 'Campmate Script', 'Sequoia Sans', system-ui, sans-serif;
      --font-sans: 'Sequoia Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --font-serif: 'Switchback', Georgia, serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --primary: #326d43;
        --primary-hover: #5d9a66;
        --primary-soft: #d9ead4;
        --primary-deep: #142419;
        --on-primary: #fff6e6;
        --on-primary-muted: #eadcc0;
        --accent: #d58a2e;
        --accent-hover: #f0a846;
        --accent-strong: #f2b04f;
        --accent-soft: #ffe3ad;
        --river: #6fb1a6;
        --river-soft: #d9fff0;
        --canopy: #4f8e55;
        --post-hover-border: #d58a2e;
        --newsletter-border: #6f955f;
        --newsletter-bg: #2f6840;
        --newsletter-bg-end: #142419;
        --bg: #101811;
        --paper: #19251b;
        --bg-soft: #213321;
        --bg-muted: #2a3d28;
        --text: #fff2dc;
        --text-light: #e8dcc3;
        --text-lighter: #c9bda3;
        --border: #4f7650;
        --shadow: 0 18px 46px -26px rgba(0, 0, 0, 0.95);
        --focus-ring: 0 0 0 3px rgba(255, 227, 173, 0.42);
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      position: relative;
      font-family: var(--font-sans);
      background: var(--bg);
      background-image:
        radial-gradient(circle at top left, rgba(183, 121, 45, 0.09), transparent 24rem),
        linear-gradient(180deg, rgba(255, 250, 240, 0.7), rgba(239, 228, 209, 0.48));
      color: var(--text);
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image: url('/assets/images/topography.svg');
      background-size: 520px 520px;
      background-repeat: repeat;
      opacity: 0.025;
      z-index: 0;
    }
    body::after {
      content: '';
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      height: min(42vh, 26rem);
      pointer-events: none;
      background-image: url('/assets/images/park-ridge.svg');
      background-position: center bottom;
      background-repeat: no-repeat;
      background-size: cover;
      opacity: 0.12;
      z-index: 0;
    }
    body > * {
      position: relative;
      z-index: 1;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background-image:
          radial-gradient(circle at 50% -10%, rgba(82, 126, 69, 0.18), transparent 32rem),
          radial-gradient(circle at 15% 18%, rgba(213, 138, 46, 0.08), transparent 24rem),
          linear-gradient(180deg, #142018 0%, #101811 56%, #0d150f 100%);
      }
      body::before { opacity: 0.045; }
      body::after { opacity: 0.2; }
    }
    a { color: var(--primary); text-decoration: none; transition: color 0.15s, opacity 0.15s, border-color 0.15s; }
    a:hover { color: var(--primary-hover); opacity: 1; }
    a:focus-visible,
    button:focus-visible,
    input:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }

    /* Header */
    .header {
      border-bottom: 3px solid var(--accent);
      padding: 0.875rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--primary);
      position: sticky;
      top: 0;
      z-index: 10;
      box-shadow: 0 12px 30px -20px rgba(0, 0, 0, 0.85);
    }
    .header .site-title {
      font-family: var(--font-display);
      font-size: 1.125rem;
      font-weight: 750;
      color: var(--on-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .header .site-title svg { height: 28px; width: 28px; color: var(--accent-soft); }
    .header nav { display: flex; align-items: center; gap: 1.25rem; }
    .header nav a { color: var(--on-primary-muted); font-size: 0.875rem; font-weight: 700; }
    .header nav a:hover { color: var(--on-primary); opacity: 1; }

    /* Container */
    .container { max-width: var(--max-width); margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }

    /* Hero */
    .hero {
      position: relative;
      overflow: hidden;
      text-align: center;
      padding: 2.75rem 2rem 2.5rem;
      border: 1px solid var(--border);
      border-top: 4px solid var(--accent);
      border-radius: var(--radius);
      background: var(--paper);
      box-shadow: var(--shadow);
      margin-bottom: 1.5rem;
    }
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url('/assets/images/topography.svg');
      background-size: 420px 420px;
      opacity: 0.045;
      pointer-events: none;
    }
    .hero::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 46%;
      background-image: url('/assets/images/park-ridge.svg');
      background-position: center bottom;
      background-repeat: no-repeat;
      background-size: 110% auto;
      opacity: 0.16;
      pointer-events: none;
    }
    .hero > * {
      position: relative;
      z-index: 1;
    }
    .park-emblem {
      width: 92px;
      height: 92px;
      margin: 0 auto 0.85rem;
      color: var(--primary);
      filter: drop-shadow(0 12px 18px rgba(0, 0, 0, 0.18));
    }
    .park-emblem svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    .hero h1 {
      font-family: var(--font-display);
      font-size: 2rem;
      font-weight: 850;
      margin-bottom: 0.5rem;
      color: var(--text);
    }
    .hero p { color: var(--text-light); font-size: 1.05rem; max-width: 540px; margin: 0 auto; font-weight: 700; }

    /* Post list */
    .post-list { list-style: none; }
    .post-item {
      position: relative;
      overflow: hidden;
      padding: 1.5rem;
      border: 1px solid var(--border);
      border-left: 4px solid var(--primary);
      border-radius: var(--radius);
      background: var(--paper);
      box-shadow: var(--shadow);
      margin-bottom: 1rem;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    }
    .post-item:hover {
      border-color: var(--post-hover-border);
      box-shadow: 0 20px 48px -26px rgba(0, 0, 0, 0.72);
      transform: translateY(-1px);
    }
    .post-item:last-child { border-bottom: 1px solid var(--border); }
    .post-tag {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      background: var(--primary-soft);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.5rem;
    }
    .post-title { font-family: var(--font-display); font-size: 1.375rem; font-weight: 750; margin-bottom: 0.4rem; }
    .post-title a { color: var(--text); }
    .post-title a:hover { color: var(--accent-strong); opacity: 1; }
    .post-meta {
      color: var(--text-lighter);
      font-size: 0.8125rem;
      margin-bottom: 0.6rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      font-weight: 800;
      text-transform: uppercase;
    }
    .post-meta .sep { color: var(--border); }
    .post-excerpt { font-family: var(--font-serif); color: var(--text-light); line-height: 1.72; font-size: 0.975rem; }
    .read-more { display: inline-block; margin-top: 0.75rem; font-size: 0.875rem; font-weight: 800; color: var(--accent-strong); }
    .read-more:hover { color: var(--primary-hover); }

    /* Newsletter */
    .newsletter-card {
      position: relative;
      overflow: hidden;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
      gap: 1.5rem;
      align-items: center;
      padding: 1.5rem;
      margin: 0 0 1rem;
      border: 1px solid var(--newsletter-border);
      border-top: 4px solid var(--accent);
      border-radius: var(--radius);
      background:
        linear-gradient(135deg, var(--newsletter-bg), var(--newsletter-bg-end));
      color: var(--on-primary);
      box-shadow: var(--shadow);
    }
    .newsletter-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url('/assets/images/topography.svg');
      background-size: 360px 360px;
      opacity: 0.09;
      pointer-events: none;
    }
    .newsletter-content,
    .newsletter-form {
      position: relative;
      z-index: 1;
    }
    .newsletter-eyebrow {
      color: var(--accent-soft);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 0.35rem;
    }
    .newsletter-card h2 {
      font-family: var(--font-display);
      font-size: 1.35rem;
      line-height: 1.2;
      margin-bottom: 0.4rem;
      color: var(--on-primary);
    }
    .newsletter-card p {
      color: var(--on-primary-muted);
      font-family: var(--font-serif);
      font-size: 0.95rem;
      line-height: 1.55;
    }
    .newsletter-form {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .newsletter-form input {
      min-width: 13rem;
      flex: 1;
      height: 3rem;
      border: 1px solid rgba(255, 247, 231, 0.65);
      border-radius: 6px;
      background: #fff8ea;
      color: #263126;
      padding: 0 0.85rem;
      font: inherit;
      line-height: normal;
      font-weight: 700;
    }
    .newsletter-form input::placeholder { color: #6b6f65; opacity: 1; }
    .newsletter-form button {
      height: 3rem;
      border: 0;
      border-radius: 6px;
      background: var(--accent);
      color: #fff8ea;
      cursor: pointer;
      font: inherit;
      line-height: normal;
      font-weight: 800;
      padding: 0 1rem;
      white-space: nowrap;
    }
    .newsletter-form button:hover {
      background: var(--accent-hover);
    }

    /* Featured badge */
    .featured-badge {
      display: inline-block;
      background: var(--accent);
      color: #fff8ea;
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      margin-left: 0.5rem;
      vertical-align: middle;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* Post page */
    .back-link { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--text-light); font-size: 0.875rem; font-weight: 500; margin-bottom: 1.5rem; }
    .back-link:hover { color: var(--accent-strong); }
    .post-header {
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .post-header h1 { font-family: var(--font-display); font-size: 2.25rem; font-weight: 850; margin-bottom: 0.75rem; line-height: 1.25; }
    .post-poster { width: 100%; border-radius: 12px; margin-bottom: 2rem; aspect-ratio: 16/9; object-fit: cover; }
    .author-info { display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; }
    .author-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
    .author-name { font-weight: 600; font-size: 0.9rem; }
    .author-bio { color: var(--text-light); font-size: 0.8125rem; }

    /* Post content */
    .post-content { font-family: var(--font-serif); line-height: 1.8; font-size: 1.0625rem; }
    .post-content p { margin-bottom: 1.5rem; }
    .post-content h2 { font-family: var(--font-sans); margin-top: 2.5rem; margin-bottom: 0.75rem; font-size: 1.5rem; font-weight: 700; }
    .post-content h3 { font-family: var(--font-sans); margin-top: 2rem; margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 600; }
    .post-content img { max-width: 100%; border-radius: var(--radius); margin: 1.5rem 0; }
    .post-content pre { background: var(--bg-soft); color: var(--text); padding: 1.25rem; border-radius: var(--radius); overflow-x: auto; margin: 1.5rem 0; border: 1px solid var(--border); font-size: 0.875rem; }
    .post-content code { font-family: 'Fira Code', 'JetBrains Mono', monospace; font-size: 0.875em; }
    .post-content p code { background: var(--bg-muted); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.85em; }
    .post-content ul { margin-bottom: 1.5rem; padding-left: 1.5rem; }
    .post-content li { margin-bottom: 0.35rem; }
    .post-content a { text-decoration: underline; text-underline-offset: 2px; }
    .post-content strong { font-weight: 600; }

    /* Post footer */
    .post-footer { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border); }
    .post-footer .author-card { display: flex; gap: 1rem; align-items: flex-start; padding: 1.25rem; background: var(--paper); border: 1px solid var(--border); border-radius: var(--radius); }
    .post-footer .author-card img { width: 48px; height: 48px; border-radius: 50%; }

    /* Footer */
    .footer {
      border-top: 3px solid var(--accent);
      padding: 2rem;
      text-align: center;
      color: var(--on-primary-muted);
      font-size: 0.8125rem;
      margin-top: 2rem;
      background: var(--primary);
    }
    .footer a { color: var(--accent-soft); font-weight: 800; }

    /* Pagination */
    .pagination { display: flex; justify-content: center; gap: 0.75rem; margin-top: 2.5rem; }
    .pagination a {
      padding: 0.5rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
      background: var(--paper);
    }
    .pagination a:hover { border-color: var(--accent); color: var(--accent-strong); opacity: 1; }

    @media (max-width: 640px) {
      .header { padding: 0.75rem 1rem; gap: 0.75rem; }
      .header .site-title { font-size: 0.95rem; white-space: nowrap; }
      .header .site-title svg { height: 18px; width: 18px; }
      .header nav { gap: 0.75rem; }
      .header nav a { font-size: 0.75rem; }
      .park-emblem { width: 76px; height: 76px; }
      .hero h1 { font-size: 1.5rem; }
      .hero::after { height: 38%; background-size: 180% auto; }
      .newsletter-card { grid-template-columns: 1fr; padding: 1.25rem; }
      .newsletter-form { flex-direction: column; align-items: stretch; }
      .newsletter-form input,
      .newsletter-form button { width: 100%; }
      .post-title { font-size: 1.15rem; }
      .post-header h1 { font-size: 1.75rem; }
      .container { padding: 1.5rem 1rem 3rem; }
    }
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="site-title">
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 2.5 27.7 8v10.3c0 4.8-3.1 8.7-11.7 11.2C7.4 27 4.3 23.1 4.3 18.3V8L16 2.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="m8.7 19.2 5.2-6.6 3 3.8 2.3-2.8 4.2 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M11.4 21.8c2.4-1 4.3-.9 6.2 0 1.5.7 2.8.8 4.7 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M16 6.6v3.8M12.9 9.7h6.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      ${escapeHtml(config.title)}
    </a>
    <nav>
      <a href="/">Posts</a>
      <a href="https://stacksjs.com/docs">Docs</a>
      ${config.enableRss ? '<a href="/feed.xml">RSS</a>' : ''}
      ${config.social.github ? `<a href="https://github.com/${config.social.github}" target="_blank" rel="noopener">GitHub</a>` : ''}
    </nav>
  </header>
  <main class="container">
    ${content}
  </main>
  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} ${escapeHtml(config.title)}. Built with <a href="https://stacksjs.org">Stacks</a>.</p>
  </footer>
</body>
</html>`
}

function generateNewsletterCapture(source = 'blog-static'): string {
  return `<section id="newsletter" class="newsletter-card" aria-label="Subscribe to Stacks updates">
      <div class="newsletter-content">
        <div class="newsletter-eyebrow">Trail dispatch</div>
        <h2>Get new Stacks notes by email</h2>
        <p>Short framework updates, release notes, and field guides for building with Stacks.</p>
      </div>
      <form class="newsletter-form" action="https://stacksjs.com/api/email/subscribe" method="POST">
        <input type="hidden" name="source" value="${escapeHtml(source)}">
        <input type="email" name="email" placeholder="you@example.com" autocomplete="email" required>
        <button type="submit">Subscribe</button>
      </form>
    </section>`
}

function generatePostCard(post: PostRow, author?: AuthorRow): string {
  const slug = getSlug(post)
  const date = post.published_at ? formatDate(post.published_at) : ''
  const authorName = author?.name || 'Stacks Team'
  const rawExcerpt = post.excerpt || (post.body || post.content || '').slice(0, 220)
  const excerpt = rawExcerpt.replace(/[#*`\[\]]/g, '').trim()
  const featured = post.is_featured ? '<span class="featured-badge">Featured</span>' : ''
  const readTime = estimateReadingTime(post.body || post.content || '')

  return `<li class="post-item">
    <h2 class="post-title"><a href="/posts/${escapeHtml(slug)}/">${escapeHtml(post.title)}${featured}</a></h2>
    <div class="post-meta">
      <span>${escapeHtml(authorName)}</span>
      <span class="sep">&middot;</span>
      <span>${date}</span>
      <span class="sep">&middot;</span>
      <span>${readTime} min read</span>
    </div>
    <p class="post-excerpt">${escapeHtml(excerpt)}${excerpt.length >= 200 ? '...' : ''}</p>
    <a href="/posts/${escapeHtml(slug)}/" class="read-more">Read more &rarr;</a>
  </li>`
}

function generatePostPage(post: PostRow, config: BlogConfig, author?: AuthorRow): string {
  const date = post.published_at ? formatDate(post.published_at) : ''
  const bodyContent = post.body || post.content || ''
  const authorName = author?.name || 'Stacks Team'
  const readTime = estimateReadingTime(bodyContent)

  const authorHtml = author
    ? `<div class="author-info">
        ${author.avatar ? `<img src="${escapeHtml(author.avatar)}" alt="${escapeHtml(author.name)}" class="author-avatar" />` : ''}
        <div>
          <div class="author-name">${escapeHtml(author.name)}</div>
          ${author.bio ? `<div class="author-bio">${escapeHtml(author.bio.slice(0, 100))}</div>` : ''}
        </div>
      </div>`
    : `<div class="author-info">
        <div>
          <div class="author-name">${escapeHtml(authorName)}</div>
        </div>
      </div>`

  const authorFooter = author
    ? `<div class="post-footer">
        <div class="author-card">
          ${author.avatar ? `<img src="${escapeHtml(author.avatar)}" alt="${escapeHtml(author.name)}" />` : ''}
          <div>
            <div class="author-name">${escapeHtml(author.name)}</div>
            ${author.bio ? `<p style="color: var(--text-light); font-size: 0.875rem; margin-top: 0.25rem;">${escapeHtml(author.bio)}</p>` : ''}
          </div>
        </div>
      </div>`
    : ''

  const content = `
    <a href="/" class="back-link">&larr; All posts</a>
    <article>
      <div class="post-header">
        <h1>${escapeHtml(post.title)}</h1>
        <div class="post-meta">
          <span>${escapeHtml(authorName)}</span>
          <span class="sep">&middot;</span>
          <span>${date}</span>
          <span class="sep">&middot;</span>
          <span>${readTime} min read</span>
        </div>
        ${authorHtml}
      </div>
      <div class="post-content">
        ${renderMarkdownish(bodyContent)}
      </div>
      ${authorFooter}
    </article>`

  return generateLayout(config, post.title, content, { isPost: true })
}

function generateIndexPage(posts: PostRow[], config: BlogConfig, authors: Map<number, AuthorRow>, page: number, totalPages: number): string {
  const postCards = posts.map(post => {
    const author = post.author_id ? authors.get(post.author_id) : undefined
    return generatePostCard(post, author)
  }).join('\n')

  let pagination = ''
  if (totalPages > 1) {
    const prev = page > 1 ? `<a href="${page === 2 ? '/' : `/page/${page - 1}/`}">&larr; Newer</a>` : ''
    const next = page < totalPages ? `<a href="/page/${page + 1}/">Older &rarr;</a>` : ''
    pagination = `<div class="pagination">${prev} ${next}</div>`
  }

  const hero = page === 1 ? `
    <div class="hero">
      <div class="park-emblem" aria-hidden="true">
        <svg viewBox="0 0 96 96" fill="none">
          <path d="M48 6 82 22v30c0 18-11 30-34 38C25 82 14 70 14 52V22L48 6Z" fill="var(--primary)" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round"/>
          <path d="M24 58 41 36l10 13 8-10 14 19" stroke="var(--accent-soft)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M29 69c8-5 15-5 23-1 6 3 12 3 20-1" stroke="var(--river-soft)" stroke-width="5" stroke-linecap="round"/>
          <path d="M48 18v13M38 31h20" stroke="var(--accent-soft)" stroke-width="5" stroke-linecap="round"/>
          <path d="m28 64 8-13 8 13H28ZM59 65l7-12 7 12H59Z" fill="var(--canopy)"/>
        </svg>
      </div>
      <h1>${escapeHtml(config.title)}</h1>
      <p>${escapeHtml(config.description)}</p>
    </div>` : ''

  const content = `
    ${hero}
    ${page === 1 ? generateNewsletterCapture() : ''}
    <ul class="post-list">
      ${postCards}
    </ul>
    ${pagination}`

  return generateLayout(config, config.title, content)
}

function generateRssFeed(posts: PostRow[], config: BlogConfig, domain: string): string {
  const items = posts.map(post => {
    const slug = getSlug(post)
    const pubDate = post.published_at ? formatRssDate(post.published_at) : ''
    const description = post.excerpt || (post.body || post.content || '').slice(0, 300)
    return `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>https://${domain}/posts/${escapeXml(slug)}/</link>
    <guid>https://${domain}/posts/${escapeXml(slug)}/</guid>
    <description>${escapeXml(description)}</description>
    ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
  </item>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.title)}</title>
    <link>https://${domain}/</link>
    <description>${escapeXml(config.description)}</description>
    <atom:link href="https://${domain}/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`
}

function generateSitemap(posts: PostRow[], _config: BlogConfig, domain: string): string {
  const urls = posts.map((post) => {
    const slug = getSlug(post)
    const lastmod = post.updated_at || post.published_at || ''
    return `  <url>
    <loc>https://${domain}/posts/${escapeXml(slug)}/</loc>
    ${lastmod ? `<lastmod>${new Date(lastmod).toISOString().split('T')[0]}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
  </url>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${domain}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

function getDefaultBlogPosts(): PostRow[] {
  return [
    {
      id: 1,
      title: 'Introducing Stacks: A Full-Stack Framework for the Modern Web',
      slug: 'introducing-stacks',
      content: 'We are thrilled to announce the official launch of Stacks, a full-stack framework.',
      body: `We are thrilled to announce the official launch of **Stacks**, a full-stack framework designed to make building web applications, APIs, cloud infrastructure, and libraries a delightful experience.

## Why Stacks?

The JavaScript ecosystem is incredibly rich, but building a production-ready application still requires gluing together dozens of tools, configurations, and deployment pipelines. Stacks changes that.

With Stacks, you get a **unified, batteries-included framework** that handles everything from your database models and API routes to cloud infrastructure and documentation sites — all from a single, cohesive project.

## What Makes Stacks Different

- **Model-View-Action (MVA)**: A fresh take on MVC that emphasizes clarity and simplicity
- **Type-Safe by Default**: Built on TypeScript with deep type inference throughout
- **Cloud-Native**: Define your AWS infrastructure in \`config/cloud.ts\` and deploy with \`./buddy deploy\`
- **Zero-Config DX**: Linting, testing, CI/CD pipelines, and documentation generation — all preconfigured
- **Library Extraction**: Build your app, then extract reusable Vue components and TypeScript functions as publishable packages

## Getting Started

Getting started with Stacks is simple:

\`\`\`bash
bunx stacks new my-app
cd my-app
./buddy dev
\`\`\`

This gives you a fully configured project with a dev server, database, API routes, and more — all ready to go.

## What's Next

We are actively working on expanding Stacks with more features, better documentation, and a growing ecosystem of plugins. Follow us on [GitHub](https://github.com/stacksjs/stacks) and join the conversation.

The future of full-stack development is here. Let's build something great together.`,
      excerpt: 'We are thrilled to announce the official launch of Stacks, a full-stack framework designed to make building web applications, APIs, and cloud infrastructure a delightful experience.',
      status: 'published',
      published_at: '2026-02-20T10:00:00.000Z',
      views: 1250,
      is_featured: 1,
      created_at: '2026-02-20T10:00:00.000Z',
      updated_at: '2026-02-20T10:00:00.000Z',
    },
    {
      id: 2,
      title: 'Deploying to AWS with a Single Command',
      slug: 'deploying-to-aws',
      content: 'Learn how Stacks makes cloud deployment as simple as running ./buddy deploy.',
      body: `One of the most powerful features of Stacks is its built-in cloud deployment pipeline. Instead of wrestling with Terraform, CDK, or manual AWS console clicks, you can deploy your entire application — API, frontend, docs, and blog — with a single command.

## The Problem with Cloud Deployment

Most teams spend weeks setting up their deployment pipelines. You need to configure CloudFormation or Terraform templates, set up CI/CD, manage SSL certificates, configure CloudFront distributions, and handle database migrations. It's tedious and error-prone.

## How Stacks Solves It

With Stacks, your cloud infrastructure is defined in a simple TypeScript configuration file:

\`\`\`typescript
// config/cloud.ts
export const tsCloud = {
  project: { name: 'my-app', region: 'us-east-1' },
  infrastructure: {
    compute: { instances: 1, size: 'small' },
    storage: {
      public: { website: { indexDocument: 'index.html' } },
      docs: { website: { indexDocument: 'index.html' } },
    },
    ssl: { enabled: true, domains: ['myapp.com', 'docs.myapp.com'] },
    dns: { domain: 'myapp.com' },
  },
}
\`\`\`

Then deploy everything:

\`\`\`bash
./buddy deploy --yes
\`\`\`

## What Happens Under the Hood

When you run \`./buddy deploy\`, Stacks:

- **Generates a CloudFormation template** from your config
- **Provisions EC2 instances** with your Bun application
- **Creates S3 buckets** for static sites (frontend, docs, blog)
- **Sets up CloudFront** distributions with SSL certificates
- **Configures Route53** DNS records
- **Runs database migrations** on the remote server
- **Uploads static assets** to S3 with proper cache headers
- **Invalidates CloudFront** caches for instant updates

All of this happens automatically, with progress output so you know exactly what's happening.

## Zero-Downtime Updates

Subsequent deployments are incremental. Stacks detects what changed and only updates the necessary resources. Your users never experience downtime.

## Try It Yourself

If you have an AWS account, you can deploy a Stacks app in under 10 minutes. Check out our [deployment guide](https://stacksjs.com/docs/bootcamp/deploy) to get started.`,
      excerpt: 'Learn how Stacks makes cloud deployment as simple as running a single command. No Terraform, no CDK — just ./buddy deploy.',
      status: 'published',
      published_at: '2026-02-18T14:00:00.000Z',
      views: 840,
      is_featured: 0,
      created_at: '2026-02-18T14:00:00.000Z',
      updated_at: '2026-02-18T14:00:00.000Z',
    },
    {
      id: 3,
      title: 'Building Type-Safe APIs with the Stacks ORM',
      slug: 'type-safe-apis',
      content: 'Discover how Stacks models auto-generate fully typed API endpoints.',
      body: `One of the most tedious parts of building a web application is writing CRUD boilerplate. With Stacks, your models automatically generate fully typed API endpoints, database migrations, factories, and seeders.

## Define a Model, Get an API

Here's what a typical Stacks model looks like:

\`\`\`typescript
// app/Models/Post.ts
export default defineModel({
  name: 'Post',
  table: 'posts',
  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'posts',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },
  attributes: {
    title: {
      validation: { rule: schema.string().min(3).max(255) },
      factory: faker => faker.lorem.sentence(),
    },
    slug: {
      unique: true,
      validation: { rule: schema.string().min(3).max(255) },
    },
    body: {
      validation: { rule: schema.string() },
    },
  },
})
\`\`\`

From this single file, Stacks generates:

- **API routes**: \`GET /api/posts\`, \`POST /api/posts\`, \`GET /api/posts/:id\`, \`PATCH /api/posts/:id\`, \`DELETE /api/posts/:id\`
- **Database migration**: Creates the \`posts\` table with all columns
- **Factory**: Generates realistic test data using Faker
- **Seeder**: Populates your database with sample data
- **TypeScript types**: Full type inference for queries and responses

## Type-Safe Queries

The Stacks ORM is built on Kysely, giving you fully type-safe database queries:

\`\`\`typescript
const posts = await db
  .selectFrom('posts')
  .where('status', '=', 'published')
  .orderBy('published_at', 'desc')
  .selectAll()
  .execute()
\`\`\`

Every column name, operator, and value is type-checked at compile time. Typos become compile errors, not runtime bugs.

## Relationships

Stacks supports all common relationship types with a clean, declarative syntax:

\`\`\`typescript
export default defineModel({
  name: 'Post',
  belongsTo: ['Author'],
  traits: { taggable: true, categorizable: true, commentables: true },
})
\`\`\`

## What's Next

We are working on even more ORM features — real-time subscriptions, full-text search integration, and automatic OpenAPI documentation generation. Stay tuned.`,
      excerpt: 'Discover how Stacks models auto-generate fully typed API endpoints, database migrations, and more from a single model definition.',
      status: 'published',
      published_at: '2026-02-15T09:00:00.000Z',
      views: 620,
      is_featured: 0,
      created_at: '2026-02-15T09:00:00.000Z',
      updated_at: '2026-02-15T09:00:00.000Z',
    },
    {
      id: 4,
      title: 'Meet Buddy: Your CLI Companion for Stacks Development',
      slug: 'meet-buddy-cli',
      content: 'Buddy is the CLI tool that powers your entire Stacks development workflow.',
      body: `Every great framework needs a great CLI. In Stacks, that CLI is called **Buddy** — your companion for development, testing, deployment, and everything in between.

## What Can Buddy Do?

Buddy is the single entry point for every task in your Stacks project:

\`\`\`bash
./buddy dev          # Start the development server
./buddy build        # Build for production
./buddy test         # Run your test suite
./buddy deploy       # Deploy to the cloud
./buddy generate     # Generate models, migrations, and more
./buddy lint         # Lint and format your code
./buddy key:generate # Generate a new application key
\`\`\`

## Developer Experience First

Buddy is designed to feel fast and intuitive. Some highlights:

- **Lazy-loaded commands**: Only the command you run is loaded, keeping startup under 100ms
- **Interactive mode**: Run \`./buddy\` with no arguments for a guided menu
- **Verbose mode**: Add \`--verbose\` to any command for detailed output
- **Tab completion**: Full shell completion support for bash and zsh

## Extensible

You can add your own commands by creating files in \`app/Commands/\`:

\`\`\`typescript
// app/Commands/Greet.ts
export default function (buddy) {
  buddy
    .command('greet <name>', 'Greet someone')
    .action((name) => {
      console.log('Hello, ' + name + '!')
    })
}
\`\`\`

Then run it:

\`\`\`bash
./buddy greet World
# Hello, World!
\`\`\`

## Built on Bun

Buddy runs on [Bun](https://bun.sh), giving it near-instant startup times and excellent TypeScript support without a build step. Your commands are executed directly from TypeScript source.

## Try It

Start a new Stacks project and explore what Buddy can do. You might be surprised how much a good CLI can improve your workflow.`,
      excerpt: 'Buddy is the CLI tool that powers your entire Stacks development workflow — from dev server to deployment, all in one place.',
      status: 'published',
      published_at: '2026-02-12T11:30:00.000Z',
      views: 450,
      is_featured: 0,
      created_at: '2026-02-12T11:30:00.000Z',
      updated_at: '2026-02-12T11:30:00.000Z',
    },
    {
      id: 5,
      title: 'Documentation as a First-Class Citizen',
      slug: 'documentation-first-class',
      content: 'How Stacks makes writing and deploying documentation effortless.',
      body: `Good documentation is the difference between a framework people try and a framework people adopt. That's why Stacks treats documentation as a **first-class feature**, not an afterthought.

## Write Docs, Deploy Docs

Every Stacks project comes with a \`docs/\` directory preconfigured. Write your documentation in Markdown, and Stacks builds it into a beautiful static site using [BunPress](https://github.com/stacksjs/bunpress).

\`\`\`bash
./buddy dev:docs    # Preview docs locally
./buddy deploy      # Docs deploy automatically to docs.yoursite.com
\`\`\`

## What You Get

- **Beautiful defaults**: Clean, responsive design with dark mode support
- **Sidebar navigation**: Automatically generated from your file structure
- **Syntax highlighting**: Code blocks with proper language highlighting
- **Search**: Built-in search functionality
- **Automatic deployment**: Docs deploy to a dedicated S3 bucket + CloudFront CDN

## Powered by BunPress

Under the hood, Stacks uses BunPress — a fast, minimal static site generator built on Bun. It takes your Markdown files and produces optimized HTML with:

- Table of contents generation
- Anchor links for headings
- Responsive images
- SEO-friendly output with sitemaps and meta tags

## Documentation is Part of Your Deploy

When you run \`./buddy deploy\`, your documentation is automatically:

- Built from the \`docs/\` directory
- Uploaded to an S3 bucket
- Served via CloudFront at \`docs.yourdomain.com\`
- Cache-invalidated for instant updates

No separate CI/CD pipeline needed. No extra configuration. It just works.

## Start Documenting

Great software deserves great documentation. With Stacks, there's no excuse not to write it.`,
      excerpt: 'How Stacks makes writing and deploying documentation effortless — from Markdown to a deployed docs site in seconds.',
      status: 'published',
      published_at: '2026-02-10T08:00:00.000Z',
      views: 380,
      is_featured: 0,
      created_at: '2026-02-10T08:00:00.000Z',
      updated_at: '2026-02-10T08:00:00.000Z',
    },
  ]
}

export async function buildBlogSite(options: BuildBlogOptions): Promise<void> {
  const { config, outDir } = options
  const domain = `${config.subdomain}.stacksjs.com`

  // Ensure output directory
  ensureDir(outDir)
  ensureDir(join(outDir, 'posts'))
  copyBlogFonts(outDir)
  copyBlogImages(outDir)

  // Fetch published posts from database
  let posts: PostRow[]
  let usedDefaults = false
  try {
    const dbPosts = await fetchPublishedPosts()

    // If DB posts have no slugs or are faker data, merge with defaults
    const hasRealContent = dbPosts.some(p => p.slug && p.slug !== 'null' && !p.title.endsWith('.'))
    if (dbPosts.length === 0 || !hasRealContent) {
      posts = getDefaultBlogPosts()
      usedDefaults = true
    } else {
      posts = dbPosts
    }
  } catch {
    console.log('  Database not available, using default blog posts')
    posts = getDefaultBlogPosts()
    usedDefaults = true
  }

  if (usedDefaults) {
    console.log('  Using built-in blog posts (seed your database for custom content)')
  }

  // Fetch authors
  const authors = new Map<number, AuthorRow>()
  try {
    const authorRows = await fetchAuthors()
    for (const author of authorRows) {
      authors.set(author.id, author)
    }
  } catch {
    // Authors table may not exist yet
  }

  // Generate paginated index pages
  const postsPerPage = config.postsPerPage || 10
  const totalPages = Math.max(1, Math.ceil(posts.length / postsPerPage))

  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * postsPerPage
    const pagePosts = posts.slice(start, start + postsPerPage)
    const html = generateIndexPage(pagePosts, config, authors, page, totalPages)

    if (page === 1) {
      writeFileSync(join(outDir, 'index.html'), html)
    }

    if (totalPages > 1) {
      const pageDir = join(outDir, 'page', String(page))
      ensureDir(pageDir)
      writeFileSync(join(pageDir, 'index.html'), html)
    }
  }

  // Generate individual post pages
  const generatedSlugs = new Set<string>()
  for (const post of posts) {
    const slug = getSlug(post)

    // Skip duplicate slugs
    if (generatedSlugs.has(slug)) continue
    generatedSlugs.add(slug)

    const postDir = join(outDir, 'posts', slug)
    ensureDir(postDir)

    const author = post.author_id ? authors.get(post.author_id) : undefined
    const html = generatePostPage(post, config, author)
    writeFileSync(join(postDir, 'index.html'), html)
  }

  // Generate RSS feed
  if (config.enableRss) {
    const rss = generateRssFeed(posts.slice(0, 20), config, domain)
    writeFileSync(join(outDir, 'feed.xml'), rss)
  }

  // Generate sitemap
  if (config.enableSitemap) {
    const sitemap = generateSitemap(posts, config, domain)
    writeFileSync(join(outDir, 'sitemap.xml'), sitemap)
  }

  // Generate 404 page
  const notFoundContent = `
    <div style="text-align: center; padding: 6rem 0;">
      <p style="font-size: 5rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 0.5rem;">404</p>
      <p style="color: var(--text-light); margin-bottom: 1.5rem; font-size: 1.125rem;">This page could not be found.</p>
      <a href="/" style="display: inline-block; padding: 0.6rem 1.5rem; background: var(--primary); color: white; border-radius: 6px; font-weight: 500; font-size: 0.9rem;">Back to blog</a>
    </div>`
  writeFileSync(join(outDir, '404.html'), generateLayout(config, '404 - Not Found', notFoundContent))

  console.log(`  Generated ${generatedSlugs.size} post pages, ${totalPages} index page(s)`)
  if (config.enableRss) console.log('  Generated feed.xml')
  if (config.enableSitemap) console.log('  Generated sitemap.xml')
}
