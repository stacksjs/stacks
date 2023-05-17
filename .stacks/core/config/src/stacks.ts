import { loadConfig } from 'c12'
import type { ResolvedStacksOptions, StacksOptions } from '@stacksjs/types'
import { app, cache, cdn, cli, database, debug, dns, docs, email, events, git, hashing, library, notification, payment, searchEngine, services, storage, ui } from './defaults'

export const stacksConfigDefaults = {
  app,
  cache,
  cdn,
  cli,
  database,
  debug,
  dns,
  docs,
  email,
  event: events,
  git,
  hashing,
  library,
  notification,
  payment,
  searchEngine,
  services,
  storage,
  ui,
} satisfies ResolvedStacksOptions

export async function loadStacksConfig(overrides?: Partial<StacksOptions>, cwd = process.cwd()) {
  const { config } = await loadConfig<StacksOptions>({
    name: 'stacks',
    defaults: stacksConfigDefaults,
    overrides: {
      ...(overrides as StacksOptions),
    },
    cwd,
  })

  return config!
}

export function defineStacksConfig(config: Partial<StacksOptions>) {
  return config
}
