import type { AppOptions } from 'stacks'

export const app: AppOptions = {
  name: import.meta.env.APP_NAME || 'Stacks',
  env: import.meta.env.APP_ENV || 'local',
  url: import.meta.env.APP_URL || 'http://localhost:3333',
  debug: import.meta.env.APP_DEBUG || true,
  port: import.meta.env.APP_PORT || 3333,
  host: import.meta.env.APP_HOST || '',
  key: import.meta.env.APP_KEY,
  timezone: 'UTC',
  locale: 'en',
  fallbackLocale: 'en',
  editor: 'vscode',
  cipher: 'aes-256-cbc',
  inspect: '',
}
