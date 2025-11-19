// import type { CliOptions } from '@stacksjs/types'
import { CLI, cli as createCli } from '@stacksjs/clapp'
// Note: applyTheme and getAvailableThemes will be available after @stacksjs/clapp npm package is updated
// import { applyTheme, getAvailableThemes } from '@stacksjs/clapp'

export interface ParsedArgv {
  args: ReadonlyArray<string>
  options: {
    [k: string]: any
  }
}

interface CliOptions {
  name?: string
  // version: string
  // description: string
}

export function cli(name?: string | CliOptions, options?: CliOptions): CLI {
  if (typeof name === 'object') {
    options = name
    name = options.name
  }

  return createCli(name || 'buddy')
}

export { CLI }
// Note: applyTheme and getAvailableThemes exports will be available after @stacksjs/clapp npm package is updated
// export { applyTheme, getAvailableThemes }

// export function command(name: string, description: string, options?: CliOptions) {
//   return cli(options).command(name, description)
// }
