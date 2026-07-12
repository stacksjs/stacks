export interface BlogConfig {
  subdomain: string
  title: string
  description: string
  postsPerPage: number
  enableComments: boolean
  enableRss: boolean
  enableSitemap: boolean
  enableSearch: boolean
  /** Short title used in the blog layout nav; defaults to `title`. */
  siteTitle?: string
  /** Fallback post author when frontmatter has none. */
  author?: string
  /** Canonical site origin for feed/sitemap URLs when no request origin exists. */
  url?: string
  nav?: { text: string, link: string }[]
  /** Which modes the blog theme toggle offers. */
  themes?: ('colored' | 'light' | 'dark')[]
  defaultTheme?: 'colored' | 'light' | 'dark'
  /** Raw HTML for the blog footer colophon line. */
  colophon?: string
  social: {
    twitter?: string
    github?: string
  }
  theme: {
    primaryColor: string
    logo?: string
  }
}

const config: BlogConfig = {
  subdomain: 'blog',
  title: 'The Stacks Blog',
  description: 'Notes from building a full-stack TypeScript framework whose only dependencies are TypeScript and Bun.',
  postsPerPage: 10,
  enableComments: true,
  enableRss: true,
  enableSitemap: true,
  enableSearch: true,
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
  social: {
    twitter: 'stacksjs',
    github: 'stacksjs/stacks',
  },
  theme: {
    primaryColor: '#2f5d3a',
    logo: '/images/logos/logo-transparent.svg',
  },
}

export default config
