import type { AppOptions } from 'stacks'

export const app: AppOptions = {
  name: env('APP_NAME', 'Stacks'),
  env: env('APP_ENV', 'local'),
  key: env('APP_KEY', ''),
  debug: env('APP_DEBUG', true),
  url: env('APP_URL', 'https://localhost'),
  port: env('APP_PORT', 3333),

  timezone: 'UTC',
  locale: 'en',
  fallbackLocale: 'en',
  cipher: 'aes-256-cbc',
  editor: 'vscode',
  // inspect: '',
}
