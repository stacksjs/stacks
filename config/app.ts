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
  name: env.APP_NAME ?? 'Stacks',
  description: 'Stacks is a full-stack framework for building modern web applications.',
  env: env.APP_ENV ?? 'local',
  url: env.APP_URL ?? 'stacks.localhost',
  redirectUrls: ['stacksjs.com'],
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

  seo: {
    sitemap: {
      /**
       * The feature, use case, and comparison pages are three dynamic routes
       * (`features/[slug].stx` and its two siblings), and a views scan cannot
       * know which slugs exist, so the sitemap listed the three overview
       * pages and none of the fifty pages under them. They are read from the
       * same lists the views render, so a page added to a list is in the
       * sitemap the moment it exists. Imported here rather than at the top of
       * the file: config loads in every process, and only the views server
       * ever asks for this.
       */
      entries: async () => {
        const [{ features }, { useCases }, { comparisons }] = await Promise.all([
          import('../resources/data/features'),
          import('../resources/data/use-cases'),
          import('../resources/data/comparisons'),
        ])

        return [
          ...features.map(feature => ({ loc: `/features/${feature.slug}`, changefreq: 'monthly' as const, priority: 0.8 })),
          ...useCases.map(useCase => ({ loc: `/use-cases/${useCase.slug}`, changefreq: 'monthly' as const, priority: 0.7 })),
          ...comparisons.map(comparison => ({ loc: `/compare/${comparison.slug}`, changefreq: 'monthly' as const, priority: 0.7 })),
        ]
      },
    },
  },
} satisfies AppConfig
