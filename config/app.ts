import type { InspectOptions } from 'stacks'

export const app = {
  name: import.meta.env.APP_NAME || 'Stacks',
  env: import.meta.env.APP_ENV || 'local',
  url: import.meta.env.APP_URL || 'http://localhost:3333',
  debug: import.meta.env.APP_DEBUG || true,
  port: process.env.PORT || 3333,
  host: process.env.HOST || '',
  key: import.meta.env.APP_KEY,
  timezone: 'UTC',
  locale: 'en',
  fallbackLocale: 'en',
  editor: 'vscode',
  cipher: 'aes-256-cbc',
  inspect: <InspectOptions>{},
}
