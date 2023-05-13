import { loadConfig } from 'c12'
import type { ResolvedStacksOptions, StacksOptions } from './types'
import { app, cache, cdn, cli, cronJobs, database, debug, dns, docs, email, events, git, hashing, library, notification, payment, searchEngine, services, storage, ui } from './user'

export const defaults: ResolvedStacksOptions = { app, cache, cdn, cli, cronJobs, database, debug, dns, docs, email, events, git, hashing, library, notification, payment, searchEngine, services, storage, ui }

export async function resolveConfig(options: StacksOptions) {
  // const { loadConfig } = await import('c12')
  const config = await loadConfig<StacksOptions>({
    name: 'stacks',
    defaults: {},
    overrides: options,
  }).then(r => r.config || defaults)

  return config as ResolvedStacksOptions
}

export * from './types'

export { loadConfig, watchConfig } from 'c12'
