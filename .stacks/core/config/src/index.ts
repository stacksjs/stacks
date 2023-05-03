import { loadConfig } from 'c12'
import type { ResolvedStacksOptions, StacksOptions } from './types'
import { defaultConfig } from './defaults'

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
    defaults: defaultConfig,
    overrides: options,
  }).then(r => r.config || defaultConfig)

  return config as ResolvedStacksOptions
}

export * from './types'
