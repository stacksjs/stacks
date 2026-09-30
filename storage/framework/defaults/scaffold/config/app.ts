import type { AppConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Application Configuration**
 *
 * This configuration defines all of your application options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  name: env.APP_NAME ?? '__APP_NAME__',
  // Shown on the starter page, the coming-soon page, and any page that sets
  // no description of its own.
  description: '',
  env: env.APP_ENV ?? 'local',
  url: env.APP_URL ?? 'stacks.localhost',
  redirectUrls: [],
  debug: env.DEBUG ?? false,
  key: env.APP_KEY,

  maintenanceMode: env.APP_MAINTENANCE ?? false,
  comingSoonMode: env.APP_COMING_SOON ?? false,
  comingSoonSecret: env.APP_COMING_SOON_SECRET ?? '',
  // docMode: true, // instead of example.com/docs, deploys example.com as main entry point for docs
  docMode: false,

  timezone: 'America/Los_Angeles',
  locale: 'en',
  fallbackLocale: 'en',
  cipher: 'aes-256-cbc',

  // /sitemap.xml and /robots.txt are generated from resources/views, in dev
  // and production alike. A page that says `noindex` (a robots meta tag, or
  // `const noindex = true` in its server script) is left out, as are dynamic
  // [param] routes, error pages and anything robots.txt disallows. A file you
  // put in public/ wins over the generated one.
  seo: {
    sitemap: {
      // Concrete URLs for dynamic routes, e.g. '/products/blue-mug'.
      include: [],
      exclude: [],
    },
    robots: {
      // Added to the default '/api/'.
      disallow: [],
    },
  },
} satisfies AppConfig
