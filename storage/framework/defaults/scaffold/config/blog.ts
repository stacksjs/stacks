import { env } from '@stacksjs/env'

export interface BlogConfig {
  subdomain: string
  title: string
  description: string
  postsPerPage: number
  /**
   * NOT YET HONOURED by the static blog builder. Nothing reads this: the
   * generated pages carry no comment section either way. The CMS has
   * commenting (the `commentable` trait and `comments` in `@stacksjs/cms`),
   * but the static build does not render it (stacksjs/stacks#365-adjacent;
   * found auditing config keys nothing reads).
   */
  enableComments: boolean
  /** Honoured: generates `feed.xml` and the RSS link in the layout. */
  enableRss: boolean
  /** Honoured: generates `sitemap.xml`. */
  enableSitemap: boolean
  /**
   * NOT YET HONOURED by the static blog builder. Nothing reads this and no
   * search index is generated.
   */
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

// The site origin feeds and the sitemap are written against. APP_URL is often
// a bare host, which is not a URL on its own.
const appUrl = String(env.APP_URL || '').replace(/\/+$/, '')
const siteUrl = appUrl && !/^https?:\/\//.test(appUrl) ? `https://${appUrl}` : appUrl

const config: BlogConfig = {
  subdomain: 'blog',
  title: `${env.APP_NAME || '__APP_NAME__'} Blog`,
  description: '',
  postsPerPage: 10,
  // `enableComments` and `enableSearch` are declared but not yet implemented
  // by the static blog builder - see the interface above. Left `true` so the
  // value does not have to change when they are.
  enableComments: true,
  enableRss: true,
  enableSitemap: true,
  enableSearch: true,
  author: env.APP_NAME || '__APP_NAME__',
  ...(siteUrl && { url: siteUrl }),
  nav: [
    { text: 'Home', link: '/' },
    { text: 'Blog', link: '/blog' },
  ],
  themes: ['colored', 'light', 'dark'],
  defaultTheme: 'light',
  colophon: '<a href="/blog/feed.xml">RSS</a>',
  social: {},
  theme: {
    primaryColor: '#171717',
  },
}

export default config
