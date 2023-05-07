import { loadConfig } from 'c12'
import type { ResolvedStacksOptions, StacksOptions } from './types'
import { app, cache, cdn, cli, cronJobs, database, debug, dns, email, events, git, hashing, library, notification, pages, payment, searchEngine, services, storage, ui } from './user'

const defaults: ResolvedStacksOptions = {
  app, cache, cdn, cli, cronJobs, database, debug, dns, email, events, git, hashing, library, notification, pages, payment, searchEngine, services, storage, ui
}

export function env(key: string, fallback: any) {
  // console.log('isClient', isClient)
  // if (key && import.meta?.env)
  //   return import.meta.env[key]

  return fallback
}

export { loadConfig, watchConfig } from 'c12'

export async function resolveConfig(options: StacksOptions) {
  // const { loadConfig } = await import('c12')
  const config = await loadConfig<StacksOptions>({
    name: 'stacks',
    defaults: {

    },
    overrides: options,
  }).then(r => r.config || defaults)

  return config as ResolvedStacksOptions
}

export { defaults }

export * from './types'
