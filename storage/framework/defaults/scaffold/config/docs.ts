import type { BunPressOptions } from '@stacksjs/bunpress'
import { env } from '@stacksjs/env'

/**
 * **Documentation Configuration**
 *
 * Your app's documentation site, built with BunPress from `docs/`. There is no
 * `docs/` until you create one: add `docs/index.md` and `buddy dev` serves it
 * at /docs, and `buddy deploy` builds it.
 */

// APP_URL is often a bare host, which is not a URL on its own.
const appUrl = String(env.APP_URL || '').replace(/\/+$/, '')
const siteUrl = appUrl && !/^https?:\/\//.test(appUrl) ? `https://${appUrl}` : appUrl

const config: BunPressOptions = {
  verbose: false,
  docsDir: './docs',
  outDir: './dist/docs',

  nav: [],

  markdown: {
    title: `${env.APP_NAME || '__APP_NAME__'} Documentation`,
    meta: {
      description: '',
      author: env.APP_NAME || '__APP_NAME__',
    },
    syntaxHighlightTheme: 'github-dark',
    toc: {
      enabled: true,
      minDepth: 2,
      maxDepth: 3,
    },
    sidebar: {
      '/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/' },
          ],
        },
      ],
    },
  },

  sitemap: {
    enabled: Boolean(siteUrl),
    baseUrl: siteUrl ? `${siteUrl}/docs` : '',
  },

  robots: {
    enabled: true,
  },
}

export default config
