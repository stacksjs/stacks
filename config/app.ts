import { type AppOptions as Options } from '@stacksjs/types'
import { env } from '@stacksjs/utils'

/**
 * **Application Options**
 *
 * This configuration defines all of your application options. Because Stacks is full-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export const app: Options = {
  name: env('APP_NAME', 'Stacks'),
  env: env('APP_ENV', 'local'),
  key: env('APP_KEY', ''),
  debug: env('APP_DEBUG', false),
  url: env('APP_URL', 'https://localhost'),
  port: env('APP_PORT', 3333),

  timezone: 'UTC',
  locale: 'en',
  fallbackLocale: 'en',
  cipher: 'aes-256-cbc',
  editor: 'vscode',

  font: {
    email: {
      body: 'Inter',
      title: 'Roboto',
    },
    desktop: {
      body: 'Inter',
      title: 'Roboto',
    },
    mobile: {
      body: 'Inter',
      title: 'Roboto',
    },
    web: {
      body: 'Inter',
      title: 'Roboto',
    },
  },
}
