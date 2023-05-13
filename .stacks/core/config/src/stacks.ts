import { loadConfig } from 'c12'
import type { StacksOptions } from '@stacksjs/types'

export const stacksConfigDefaults: StacksOptions = {
  app: {
    name: 'Stacks',
    env: 'local',
    key: '',
    debug: false,
    url: 'https://localhost',
    port: 3000,
    timezone: 'UTC',
    locale: 'en',
    fallbackLocale: 'en',
    cipher: 'aes-256-cbc',
    editor: 'vscode',
  },

  cache: {},
  cli: {},
  database: {},
  debug: {},
  dns: {},
  hashing: {},
  library: {},
  notification: {},
  payment: {},
  searchEngine: {},
  services: {},
  storage: {},
  ui: {}
}

export async function loadStacksConfig(overrides?: Partial<StacksOptions>, cwd = process.cwd()) {
  const { config } = await loadConfig<StacksOptions>({
    name: 'bump',
    defaults: stacksConfigDefaults,
    overrides: {
      ...(overrides as StacksOptions),
    },
    cwd,
  })

  return config!
}

export function defineConfig(config: Partial<StacksOptions>) {
  return config
}
