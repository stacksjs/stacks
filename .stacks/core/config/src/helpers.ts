import { loadConfig, watchConfig } from 'c12'
import { frameworkPath } from '@stacksjs/path'
import type { StacksOptions as StacksConfig } from '@stacksjs/types'

export async function loadStacksConfig(overrides?: Partial<StacksConfig>, cwd = frameworkPath()) {
  const { config } = await loadConfig<StacksConfig>({
    name: 'stacks',
    defaults: configDefaults,
    overrides: {
      ...(overrides as StacksConfig),
    },
    cwd,
  })

  return config!
}

export function defineStacksConfig(config: Partial<StacksConfig>) {
  return config
}

export { loadConfig, watchConfig }
