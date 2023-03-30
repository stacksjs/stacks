import { defineAppConfig, env } from '@stacksjs/config'

/**
 * **Application Configuration**
 *
 * This configuration defines all of your application options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineAppConfig({
  name: env('APP_NAME', 'Stacks'),
  env: env('APP_ENV', 'local'),
  key: env('APP_KEY', ''),
  /**
   * The application debug mode. When enabled, Stacks will log additional
   * information to the console. This is useful for debugging purposes.
   *
   * @default false
   */
  debug: env('APP_DEBUG', false),
  url: env('APP_URL', 'https://localhost'),
  port: env('APP_PORT', 3333),

  timezone: 'UTC',
  locale: 'en',
  fallbackLocale: 'en',
  cipher: 'aes-256-cbc',
  editor: 'vscode',
})
