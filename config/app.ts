import type { AppOptions } from 'stacks'

export const app: AppOptions = {
  name: env('APP_NAME', 'Stacks'),
  env: env('APP_ENV', 'local'),
  url: env('APP_URL', 'http://localhost:3333'),
  debug: env('APP_DEBUG', true),
  port: env('APP_PORT', 3333),
  host: env('APP_HOST', ''),
  key: env('APP_KEY', ''),
  timezone: env('APP_TIMEZONE', 'UTC'),
  locale: env('APP_LOCALE', 'en'),
  fallbackLocale: env('APP_FALLBACK_LOCALE', 'en'),
  cipher: env('APP_CIPHER', 'aes-256-cbc'),
  editor: 'vscode',
  // inspect: '',
}
