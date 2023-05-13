import { loadConfig } from 'c12'
import type { StacksOptions } from '@stacksjs/types'

export const stacksConfigDefaults: StacksOptions = {
  app: {
    name: 'Stacks',
    description: 'Stacks Application',
  }
}

export async function loadStacksConfig(overrides?: Partial<StacksOptions>,
  cwd = process.cwd()) {
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
