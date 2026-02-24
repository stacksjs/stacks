import type { BlogConfig } from '../../../../config/blog'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '@stacksjs/database'

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

function generateLayout(config: BlogConfig, title: string, content: string, options?: { isPost?: boolean }): string {
  const pageTitle = title === config.title ? config.title : `${escapeHtml(title)} | ${escapeHtml(config.title)}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${escapeHtml(config.description)}">
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(config.title)}" href="/feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${config.theme.primaryColor};
      --primary-soft: ${config.theme.primaryColor}1a;
      --bg: #ffffff;
      --bg-soft: #f6f6f7;
      --bg-muted: #f0f0f2;
      --text: #1a1a2e;
      --text-light: #6b7280;
      --text-lighter: #9ca3af;
      --border: #e5e7eb;
      --max-width: 740px;
      --radius: 8px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1b1b1f;
        --bg-soft: #222226;
        --bg-muted: #2c2c30;
        --text: #e5e7eb;
        --text-light: #9ca3af;
        --text-lighter: #6b7280;
        --border: #2e2e32;
        --primary-soft: ${config.theme.primaryColor}33;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--primary); text-decoration: none; transition: opacity 0.15s; }
    a:hover { opacity: 0.8; }

    /* Header */
    .header {
      border-bottom: 1px solid var(--border);
      padding: 0.875rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(12px);
      background: var(--bg);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .header .site-title {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .header .site-title svg { height: 24px; width: 24px; }
    .header nav { display: flex; align-items: center; gap: 1.25rem; }
    .header nav a { color: var(--text-light); font-size: 0.875rem; font-weight: 500; }
    .header nav a:hover { color: var(--text); opacity: 1; }

    /* Container */
    .container { max-width: var(--max-width); margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }

    /* Hero */
    .hero {
      text-align: center;
      padding: 3rem 0 2.5rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 0.5rem;
    }
    .hero h1 {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 0.5rem;
    }
    .hero p { color: var(--text-light); font-size: 1.05rem; max-width: 500px; margin: 0 auto; }

    /* Post list */
    .post-list { list-style: none; }
    .post-item { padding: 1.75rem 0; border-bottom: 1px solid var(--border); }
    .post-item:last-child { border-bottom: none; }
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
    .post-title { font-size: 1.375rem; font-weight: 700; margin-bottom: 0.4rem; letter-spacing: -0.01em; }
    .post-title a { color: var(--text); }
    .post-title a:hover { color: var(--primary); opacity: 1; }
    .post-meta { color: var(--text-lighter); font-size: 0.8125rem; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .post-meta .sep { color: var(--border); }
    .post-excerpt { color: var(--text-light); line-height: 1.65; font-size: 0.9375rem; }
    .read-more { display: inline-block; margin-top: 0.75rem; font-size: 0.875rem; font-weight: 500; }

    /* Featured badge */
    .featured-badge {
      display: inline-block;
      background: var(--primary);
      color: white;
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
    .back-link:hover { color: var(--primary); }
    .post-header { margin-bottom: 2rem; }
    .post-header h1 { font-size: 2.25rem; font-weight: 800; margin-bottom: 0.75rem; line-height: 1.25; letter-spacing: -0.025em; }
    .post-poster { width: 100%; border-radius: 12px; margin-bottom: 2rem; aspect-ratio: 16/9; object-fit: cover; }
    .author-info { display: flex; align-items: center; gap: 0.75rem; margin-top: 1rem; }
    .author-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
    .author-name { font-weight: 600; font-size: 0.9rem; }
    .author-bio { color: var(--text-light); font-size: 0.8125rem; }

    /* Post content */
    .post-content { line-height: 1.8; font-size: 1.0625rem; }
    .post-content p { margin-bottom: 1.5rem; }
    .post-content h2 { margin-top: 2.5rem; margin-bottom: 0.75rem; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; }
    .post-content h3 { margin-top: 2rem; margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 600; }
    .post-content img { max-width: 100%; border-radius: var(--radius); margin: 1.5rem 0; }
    .post-content pre { background: var(--bg-soft); padding: 1.25rem; border-radius: var(--radius); overflow-x: auto; margin: 1.5rem 0; border: 1px solid var(--border); font-size: 0.875rem; }
    .post-content code { font-family: 'Fira Code', 'JetBrains Mono', monospace; font-size: 0.875em; }
    .post-content p code { background: var(--bg-muted); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.85em; }
    .post-content ul { margin-bottom: 1.5rem; padding-left: 1.5rem; }
    .post-content li { margin-bottom: 0.35rem; }
    .post-content a { text-decoration: underline; text-underline-offset: 2px; }
    .post-content strong { font-weight: 600; }

    /* Post footer */
    .post-footer { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border); }
    .post-footer .author-card { display: flex; gap: 1rem; align-items: flex-start; padding: 1.25rem; background: var(--bg-soft); border-radius: var(--radius); }
    .post-footer .author-card img { width: 48px; height: 48px; border-radius: 50%; }

    /* Footer */
    .footer {
      border-top: 1px solid var(--border);
      padding: 2rem;
      text-align: center;
      color: var(--text-lighter);
      font-size: 0.8125rem;
      margin-top: 2rem;
    }
    .footer a { color: var(--text-light); }

    /* Pagination */
    .pagination { display: flex; justify-content: center; gap: 0.75rem; margin-top: 2.5rem; }
    .pagination a {
      padding: 0.5rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text);
    }
    .pagination a:hover { border-color: var(--primary); color: var(--primary); opacity: 1; }

    @media (max-width: 640px) {
      .header { padding: 0.75rem 1rem; }
      .hero h1 { font-size: 1.5rem; }
      .post-header h1 { font-size: 1.75rem; }
      .container { padding: 1.5rem 1rem 3rem; }
    }
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="site-title">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
      ${escapeHtml(config.title)}
    </a>
    <nav>
      <a href="/">Posts</a>
      <a href="https://docs.stacksjs.com">Docs</a>
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
      <h1>${escapeHtml(config.title)}</h1>
      <p>${escapeHtml(config.description)}</p>
    </div>` : ''

  const content = `
    ${hero}
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

function generateSitemap(posts: PostRow[], config: BlogConfig, domain: string): string {
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

If you have an AWS account, you can deploy a Stacks app in under 10 minutes. Check out our [deployment guide](https://docs.stacksjs.com/docs/bootcamp/deploy) to get started.`,
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

  // Fetch published posts from database
  let posts: PostRow[]
  let usedDefaults = false
  try {
    const dbPosts = await db
      .selectFrom('posts')
      .where('status', '=', 'published')
      .orderBy('published_at', 'desc')
      .selectAll()
      .execute() as unknown as PostRow[]

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
    const authorRows = await db
      .selectFrom('authors')
      .selectAll()
      .execute() as unknown as AuthorRow[]
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
